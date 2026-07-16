import type { Env, PlatformType } from "@/worker/types";
import type {
	AccountService,
	AccountInfo,
	AccountStatus,
	ArticleDraft,
	Article,
	VerifyResult,
	ArticlePublishResult,
	ImageUploadResult,
	PublishTraceEvent,
	PublishTraceLogger,
} from "@/worker/accounts/types";
import type { Article as SharedArticle } from "@/shared/types";
import { sleep } from "@/worker/utils/helpers";
import { randomDelay } from "@/worker/utils/helpers";
import {
	IMAGE_MAX_ATTEMPTS,
	ImagePipelineError,
	ImagePipelineErrorCodes,
	PublishImageRuntime,
	resolveImageMimeTypeFromBlob,
	sanitizeImageErrorMessage,
	sanitizeImageUrl,
	withImageAttemptTimeout,
	type ImageOperationStats,
	type ResolvedPublishImage,
} from "@/worker/utils/media";

const PLATFORM_REQUEST_DELAY_MIN_MS = 3000;
const PLATFORM_REQUEST_DELAY_MAX_MS = 6500;

export abstract class AbstractAccountService implements AccountService {
	platform: PlatformType;
	protected authToken: string;
	protected headers: Record<string, string>;
	protected publishTraceLogger?: PublishTraceLogger;
	private publishImageRuntime?: PublishImageRuntime;
	private fallbackImageRuntime?: PublishImageRuntime;
	private lastImageOperationStats: ImageOperationStats = {
		downloadAttempts: 0,
		uploadAttempts: 0,
		verificationAttempts: 0,
		cacheHit: false,
	};

	constructor(platform: PlatformType, authToken: string, protected env?: Env) {
		this.platform = platform;
		this.authToken = authToken;
		this.headers = this.buildHeaders();
	}

	setPublishTraceLogger(logger?: PublishTraceLogger): void {
		this.publishTraceLogger = logger;
	}

	clearPublishTraceLogger(): void {
		this.publishTraceLogger = undefined;
	}

	setPublishImageRuntime(runtime?: PublishImageRuntime): void {
		this.publishImageRuntime = runtime;
	}

	clearPublishImageRuntime(): void {
		this.publishImageRuntime = undefined;
	}

	getLastImageOperationStats(): ImageOperationStats {
		return { ...this.lastImageOperationStats };
	}

	private sanitizeTraceValue(value: unknown, key = ""): unknown {
		const normalizedKey = key.toLowerCase();
		if (
			/(?:^|[_-])(cookie|authorization|access[_-]?token|secret|signature|sign|policy|auth[_-]?key)(?:$|[_-])/i.test(normalizedKey)
			|| normalizedKey.includes("authkey")
		) {
			return "***";
		}
		if (typeof value === "string") return sanitizeImageErrorMessage(value);
		if (Array.isArray(value)) return value.map((item) => this.sanitizeTraceValue(item));
		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value as Record<string, unknown>)
					.map(([entryKey, entryValue]) => [entryKey, this.sanitizeTraceValue(entryValue, entryKey)]),
			);
		}
		return value;
	}

	protected async tracePublish(event: PublishTraceEvent): Promise<void> {
		if (!this.publishTraceLogger) return;
		try {
			await this.publishTraceLogger({
				...event,
				message: sanitizeImageErrorMessage(event.message),
				metadata: event.metadata
					? this.sanitizeTraceValue(event.metadata) as Record<string, unknown>
					: undefined,
			});
		} catch {
			// Never break core publish logic because trace sink failed.
		}
	}

	protected imageVerificationHeaders(): HeadersInit {
		return {
			accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
		};
	}

	protected async resolveSourceImage(source: string, headers?: HeadersInit): Promise<ResolvedPublishImage> {
		const runtime = this.publishImageRuntime ?? (this.fallbackImageRuntime ??= new PublishImageRuntime());
		const result = await runtime.resolve(source, {
			platform: this.platform,
			trace: async (event) => await this.tracePublish(event),
			headers,
		});
		this.lastImageOperationStats = {
			...this.lastImageOperationStats,
			source: sanitizeImageUrl(source),
			downloadAttempts: result.image.downloadAttempts,
			cacheHit: result.cacheHit,
		};
		return result.image;
	}

	protected invalidImageSource(source: string, context: string): ImagePipelineError {
		return new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: `${context}: invalid image source ${sanitizeImageUrl(source)}`,
			source: sanitizeImageUrl(source),
		});
	}

	private async verifyUploadedImageUrlOnce(url: string, headers?: HeadersInit): Promise<void> {
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch (error) {
			throw new ImagePipelineError({
				code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
				stage: "verification",
				message: "Platform image upload returned an invalid URL",
				source: sanitizeImageUrl(url),
				cause: error,
			});
		}
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new ImagePipelineError({
				code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
				stage: "verification",
				message: `Platform image URL uses unsupported protocol ${parsed.protocol}`,
				source: sanitizeImageUrl(url),
			});
		}

		this.lastImageOperationStats.verificationAttempts += 1;
		const response = await fetch(parsed.toString(), {
			method: "GET",
			headers: {
				...this.imageVerificationHeaders(),
				...headers,
			},
		});
		if (!response.ok) {
			throw new ImagePipelineError({
				code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
				stage: "verification",
				message: `Platform image URL verification failed with HTTP ${response.status}`,
				source: sanitizeImageUrl(url),
				httpStatus: response.status,
			});
		}
		const blob = await response.blob();
		const mimeType = await resolveImageMimeTypeFromBlob(blob);
		if (blob.size === 0 || !mimeType.startsWith("image/")) {
			throw new ImagePipelineError({
				code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
				stage: "verification",
				message: "Platform image URL did not return a valid image",
				source: sanitizeImageUrl(url),
			});
		}
	}

	protected async verifyExistingPlatformImage(url: string, headers?: HeadersInit): Promise<void> {
		await this.resolveSourceImage(url, {
			...this.imageVerificationHeaders(),
			...headers,
		});
	}

	protected async withPlatformImageUploadRetry<T>(params: {
		source: string;
		upload: (attempt: number) => Promise<T>;
		getUploadedUrl?: (result: T) => string | null | undefined;
		uploadedUrlOptional?: boolean;
		isExpectedPlatformUrl?: (url: string) => boolean;
		validateResult?: (result: T) => void | Promise<void>;
		verificationHeaders?: HeadersInit;
	}): Promise<T> {
		let lastError: unknown;
		this.lastImageOperationStats = {
			...this.lastImageOperationStats,
			source: sanitizeImageUrl(params.source),
			uploadAttempts: 0,
			verificationAttempts: 0,
		};

		for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
			this.lastImageOperationStats.uploadAttempts = attempt;
			await this.tracePublish({
				stage: "platform_image_upload_attempt",
				message: "Upload image to platform image host",
				metadata: {
					platform: this.platform,
					source: sanitizeImageUrl(params.source),
					attempt,
					maxAttempts: IMAGE_MAX_ATTEMPTS,
				},
			});

			try {
				const result = await withImageAttemptTimeout(async () => {
					const uploaded = await params.upload(attempt);
					await params.validateResult?.(uploaded);
					const uploadedUrl = params.getUploadedUrl?.(uploaded)?.trim();
					if (params.getUploadedUrl && !uploadedUrl && !params.uploadedUrlOptional) {
						throw new ImagePipelineError({
							code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
							stage: "verification",
							message: "Platform image upload did not return an image URL",
							source: sanitizeImageUrl(params.source),
						});
					}
					if (uploadedUrl) {
						if (params.isExpectedPlatformUrl && !params.isExpectedPlatformUrl(uploadedUrl)) {
							throw new ImagePipelineError({
								code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
								stage: "verification",
								message: "Platform image upload returned a URL outside the expected image host",
								source: sanitizeImageUrl(uploadedUrl),
							});
						}
						await this.verifyUploadedImageUrlOnce(uploadedUrl, params.verificationHeaders);
					}
					return uploaded;
				});

				await this.tracePublish({
					stage: "platform_image_upload_verified",
					message: "Platform image upload and result verification succeeded",
					metadata: {
						platform: this.platform,
						source: sanitizeImageUrl(params.source),
						attempt,
						verificationAttempts: this.lastImageOperationStats.verificationAttempts,
					},
				});
				return result;
			} catch (error) {
				lastError = error;
				await this.tracePublish({
					stage: attempt < IMAGE_MAX_ATTEMPTS ? "platform_image_upload_retry" : "platform_image_upload_failed",
					level: attempt < IMAGE_MAX_ATTEMPTS ? "warn" : "error",
					message: sanitizeImageErrorMessage(error),
					metadata: {
						platform: this.platform,
						source: sanitizeImageUrl(params.source),
						attempt,
						maxAttempts: IMAGE_MAX_ATTEMPTS,
					},
				});
				if (attempt < IMAGE_MAX_ATTEMPTS) {
					const baseDelay = 500 * (2 ** (attempt - 1));
					await randomDelay(baseDelay, Math.min(baseDelay * 2, 8_000));
				}
			}
		}

		const lastErrorCode = typeof lastError === "object" && lastError !== null && "code" in lastError
			? String((lastError as { code?: unknown }).code)
			: null;
		const lastMessage = sanitizeImageErrorMessage(lastError).toLowerCase();
		const code = lastErrorCode === ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID
			|| lastMessage.includes("image url verification")
			|| lastMessage.includes("outside the expected image host")
			? ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID
			: ImagePipelineErrorCodes.PLATFORM_UPLOAD_FAILED;
		throw new ImagePipelineError({
			code,
			stage: code === ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID ? "verification" : "upload",
			message: `Platform image failed after ${IMAGE_MAX_ATTEMPTS} attempts: ${sanitizeImageErrorMessage(lastError)}`,
			source: sanitizeImageUrl(params.source),
			attempts: IMAGE_MAX_ATTEMPTS,
			cause: lastError,
		});
	}

	protected assertImageSourcesResolved(params: {
		sources: string[];
		normalize: (source: string) => string | null;
		isPlatformHosted: (source: string) => boolean;
		resolved: Map<string, string>;
		context: string;
	}): void {
		for (const source of params.sources) {
			const normalized = params.normalize(source);
			if (!normalized) throw this.invalidImageSource(source, params.context);
			if (!normalized.startsWith("data:") && params.isPlatformHosted(normalized)) continue;
			const replacement = params.resolved.get(normalized);
			if (!replacement || !params.isPlatformHosted(replacement)) {
				throw new ImagePipelineError({
					code: ImagePipelineErrorCodes.REPLACEMENT_INCOMPLETE,
					stage: "replacement",
					message: `${params.context}: image replacement is incomplete for ${sanitizeImageUrl(normalized)}`,
					source: sanitizeImageUrl(normalized),
				});
			}
		}
	}

	protected assertFinalImageSources(params: {
		sources: string[];
		normalize: (source: string) => string | null;
		isPlatformHosted: (source: string) => boolean;
		context: string;
	}): void {
		for (const source of params.sources) {
			const normalized = params.normalize(source);
			if (!normalized) throw this.invalidImageSource(source, params.context);
			if (normalized.startsWith("data:") || !params.isPlatformHosted(normalized)) {
				throw new ImagePipelineError({
					code: ImagePipelineErrorCodes.REPLACEMENT_INCOMPLETE,
					stage: "replacement",
					message: `${params.context}: final content still contains an unresolved image`,
					source: sanitizeImageUrl(normalized),
				});
			}
		}
	}

	private sanitizeUrlForLog(rawUrl: string): string {
		try {
			const parsed = new URL(rawUrl);
			const sensitiveKeys = new Set(["access_token", "token", "auth", "authorization", "cookie", "key", "secret"]);
			parsed.searchParams.forEach((_value, key) => {
				if (sensitiveKeys.has(key.toLowerCase())) {
					parsed.searchParams.set(key, "***");
				}
			});
			return parsed.toString();
		} catch {
			return rawUrl;
		}
	}

	protected abstract buildHeaders(): Record<string, string>;

	protected platformRequestDelayRange(): { minMs: number; maxMs: number } {
		return {
			minMs: PLATFORM_REQUEST_DELAY_MIN_MS,
			maxMs: PLATFORM_REQUEST_DELAY_MAX_MS,
		};
	}

	protected async waitForPlatformRequestDelay(url: string, options: RequestInit = {}): Promise<void> {
		const range = this.platformRequestDelayRange();
		const minMs = Math.max(0, range.minMs);
		const maxMs = Math.max(minMs, range.maxMs);
		if (maxMs <= 0) return;

		const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
		const method = (options.method || "GET").toUpperCase();
		const safeUrl = this.sanitizeUrlForLog(url);
		await this.tracePublish({
			stage: "platform_request_delay",
			message: "Delay before platform request",
			metadata: {
				platform: this.platform,
				method,
				url: safeUrl,
				delayMs,
			},
		});
		await sleep(delayMs);
	}

	protected async fetchPlatform(url: string, options: RequestInit = {}): Promise<Response> {
		await this.waitForPlatformRequestDelay(url, options);
		return await fetch(url, options);
	}

	/**
	 * Extract all image URLs from HTML `<img src="...">`.
	 */
	protected extractImageUrlsFromHtmlContent(htmlContent: string): string[] {
		if (!htmlContent) return [];
		const urls = new Set<string>();
		const htmlImageRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
		let match: RegExpExecArray | null;
		while ((match = htmlImageRegex.exec(htmlContent)) !== null) {
			if (match[1]) {
				urls.add(match[1]);
			}
		}
		return [...urls];
	}

	/**
	 * Extract image URLs from markdown image syntax and embedded HTML `<img>`.
	 */
	protected extractImageUrlsFromMarkdownContent(markdownContent: string): string[] {
		if (!markdownContent) return [];
		const urls = new Set<string>();
		const markdownImageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
		let match: RegExpExecArray | null;
		while ((match = markdownImageRegex.exec(markdownContent)) !== null) {
			if (match[1]) {
				urls.add(match[1]);
			}
		}

		// Markdown may contain raw HTML, e.g. <p><img src="..."></p>.
		for (const htmlImageUrl of this.extractImageUrlsFromHtmlContent(markdownContent)) {
			urls.add(htmlImageUrl);
		}

		return [...urls];
	}

	/**
	 * Collect image URLs from markdown and html in one pass (deduplicated).
	 */
	protected collectImageUrlsFromMarkdownAndHtml(markdownContent: string, htmlContent: string): string[] {
		const urls = new Set<string>([
			...this.extractImageUrlsFromMarkdownContent(markdownContent),
			...this.extractImageUrlsFromHtmlContent(htmlContent),
		]);
		return [...urls];
	}

	/**
	 * Replace HTML image URLs according to mapped platform URL cache.
	 */
	protected replaceHtmlImageUrlsByMap(
		htmlContent: string,
		normalizeImageUrl: (rawUrl: string) => string | null,
		imageUrlMap: Map<string, string>,
	): string {
		if (!htmlContent) return htmlContent;
		return htmlContent.replace(
			/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
			(fullMatch, prefix: string, src: string, suffix: string) => {
				const normalized = normalizeImageUrl(src);
				if (!normalized) return fullMatch;
				const replacement = imageUrlMap.get(normalized);
				if (!replacement) return fullMatch;
				return `${prefix}${replacement}${suffix}`;
			},
		);
	}

	/**
	 * Replace markdown image syntax and embedded HTML `<img>` URLs by map.
	 */
	protected replaceMarkdownImageUrlsByMap(
		markdownContent: string,
		normalizeImageUrl: (rawUrl: string) => string | null,
		imageUrlMap: Map<string, string>,
	): string {
		if (!markdownContent) return markdownContent;

		const replacedMarkdownSyntax = markdownContent.replace(
			/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
			(fullMatch, alt: string, src: string, title: string | undefined) => {
				const normalized = normalizeImageUrl(src);
				if (!normalized) return fullMatch;
				const replacement = imageUrlMap.get(normalized);
				if (!replacement) return fullMatch;
				const titlePart = title ? ` "${title}"` : "";
				return `![${alt}](${replacement}${titlePart})`;
			},
		);

		// Also replace raw HTML image tags that appear inside markdown.
		return this.replaceHtmlImageUrlsByMap(replacedMarkdownSyntax, normalizeImageUrl, imageUrlMap);
	}

	protected async request<T>(
		url: string,
		options: RequestInit = {},
	): Promise<T> {
		const method = (options.method || "GET").toUpperCase();
		const safeUrl = this.sanitizeUrlForLog(url);
		await this.waitForPlatformRequestDelay(url, options);

		await this.tracePublish({
			stage: "http_request_start",
			message: `${method} ${safeUrl}`,
			metadata: { method, url: safeUrl },
		});

		try {
			// Add timeout (Default 30s)
			const timeoutMs = 30000;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => {
				controller.abort();
			}, timeoutMs);

			const response = await fetch(url, {
				...options,
				headers: {
					...this.headers,
					...options.headers
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			// Handle response body based on Content-Type
			const contentType = response.headers.get("content-type");
			let data: unknown;

			if (contentType && contentType.includes("application/json")) {
				try {
					data = await response.json();
				} catch {
					data = null; // Failed to parse JSON, empty body?
				}
			} else if (contentType && (contentType.includes("text/") || contentType.includes("xml"))) {
				data = await response.text();
			} else {
				data = await response.text();
				try {
					if (typeof data === "string" && (data.startsWith("{") || data.startsWith("["))) {
						data = JSON.parse(data);
					}
				} catch {
					// Ignore parse error, keep as string
				}
			}

			await this.tracePublish({
				stage: "http_request_end",
				message: `${method} ${safeUrl} -> ${response.status}`,
				metadata: {
					method,
					url: safeUrl,
					status: response.status,
					ok: response.ok,
				},
			});

			if (!response.ok) {
				const errorMessage = typeof data === "object" && data !== null
					? JSON.stringify(data)
					: (typeof data === "string" ? data : response.statusText);

				throw new Error(`Request failed (${response.status}): ${errorMessage}`);
			}

			return data as T;
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "AbortError") {
				await this.tracePublish({
					stage: "http_request_error",
					level: "error",
					message: `Request timeout after 30s: ${safeUrl}`,
					metadata: { method, url: safeUrl, reason: "timeout" },
				});
				throw new Error(`Request timeout after 30s: ${url}`);
			}

			await this.tracePublish({
				stage: "http_request_error",
				level: "error",
				message: error instanceof Error ? error.message : "Unknown request error",
				metadata: { method, url: safeUrl },
			});

			throw error;
		}
	}

	abstract verify(): Promise<VerifyResult>;
	abstract status(): Promise<AccountStatus>;
	abstract info(): Promise<AccountInfo>;
	abstract articleDraft(article: SharedArticle): Promise<ArticleDraft | null>;
	abstract articlePublish(article: SharedArticle): Promise<ArticlePublishResult>;
	abstract articleDelete(articleId: string): Promise<{ success: boolean; message: string }>;
	abstract articleList(page?: number, pageSize?: number): Promise<Article[]>;
	abstract articleDetail(articleId: string): Promise<Article | null>;
	abstract articleTags(articleId: string): Promise<string[]>;
	abstract imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult>;
}

export interface JuejinUserInfo {
	user_id: string;
	user_name: string;
	avatar: string;
	is_realname: number;
}

export interface ZhihuUserInfo {
	uid: string;
	name: string;
	avatar_url: string;
	is_realname: boolean;
}


export interface WechatUserInfo {
	openid: string;
	nickname: string;
	headimgurl: string;
}

export interface CSDNUserInfo {
	userName: string;
	avatar: string;
}
