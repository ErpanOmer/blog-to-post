import { AbstractAccountService } from "@/worker/accounts/abstract";
import { registerAccountService } from "@/worker/accounts/index";
import type {
	AccountInfo,
	AccountStatus,
	Article,
	ArticleDraft,
	ArticlePublishResult,
	ImageUploadResult,
	VerifyResult,
} from "@/worker/accounts/index";
import type { Article as SharedArticle } from "@/shared/types";
import { convertHtmlTagsToMarkdown, normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";
import { applyMarkdownContentSlots } from "@/worker/utils/content-slots";
import { randomDelay } from "@/worker/utils/helpers";
import {
	COMMON_IMAGE_MIME_TO_EXTENSION,
	buildCloudinaryImageFormatRewriteSources,
	buildPublicImageFormatRewriteSources,
	uploadImageWithCandidates,
	type ResolvedImageUploadCandidate,
} from "@/worker/utils/media";

interface Cto51UploadSignResponse {
	code?: number | string;
	status?: number | string | boolean;
	msg?: string;
	message?: string;
	data?: {
		allows?: string;
		sizeLimit?: number;
		sizeLimitMessage?: string;
		url?: string;
		sign?: string;
	};
}

interface Cto51UploadConfigResponse {
	code?: number | string;
	status?: number | string | boolean;
	msg?: string;
	message?: string;
	data?: {
		url?: string;
		fields?: Record<string, string | undefined>;
	};
}

interface Cto51UploadConfigData {
	url: string;
	fields: Record<string, string | undefined>;
}

interface Cto51DraftResponse {
	status?: number | string | boolean;
	code?: number | string;
	msg?: string;
	message?: string;
	data?: {
		did?: string | number;
		id?: string | number;
		blog_id?: string | number;
		url?: string;
	};
}

type Cto51PublishResponse = Cto51DraftResponse;

interface Cto51ResolvedContent {
	markdownContent: string;
}

const CTO51_BASE_URL = "https://blog.51cto.com";
const CTO51_PUBLISH_URL = `${CTO51_BASE_URL}/blogger/publish`;
const CTO51_DRAFT_URL = `${CTO51_BASE_URL}/blogger/draft`;
const CTO51_UPLOAD_SIGN_URL = `${CTO51_BASE_URL}/getUploadSign`;
const CTO51_UPLOAD_CONFIG_URL = `${CTO51_BASE_URL}/getUploadConfig`;
const CTO51_DEFAULT_PUBLISH_PID = "30";
const CTO51_DEFAULT_PUBLISH_CATEGORY_ID = "62";
const CTO51_DEFAULT_USER_BLOG_PATH = "u_17718962";
const CTO51_DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default class Cto51AccountService extends AbstractAccountService {
	private readonly cookieHeader: string;
	private readonly cookieCsrfToken: string | null;
	private csrfTokenCache: string | null = null;
	private challengeCookies = new Map<string, string>();
	private imageUrlCache = new Map<string, string>();
	private draftContentCache = new Map<string, Cto51ResolvedContent>();

	constructor(authToken: string) {
		super("51cto", authToken);
		this.cookieHeader = this.normalizeCookieHeader(authToken);
		this.cookieCsrfToken =
			this.readCookieValue(this.cookieHeader, "_csrf")
			?? this.readCookieValue(this.cookieHeader, "XSRF-TOKEN")
			?? this.readCookieValue(this.cookieHeader, "csrf-token");
		this.headers = this.buildHeaders();
	}

	protected buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			accept: "application/json, text/javascript, */*; q=0.01",
			origin: CTO51_BASE_URL,
			referer: CTO51_PUBLISH_URL,
			"user-agent": CTO51_DEFAULT_USER_AGENT,
			"x-requested-with": "XMLHttpRequest",
		};
		const cookie = this.buildCombinedCookieHeader();
		if (cookie) {
			headers.cookie = cookie;
		}
		return headers;
	}

	private normalizeCookieHeader(rawToken: string): string {
		if (!rawToken) return "";
		let token = rawToken.trim();
		token = token.replace(/^cookie\s*:/i, "").trim();
		token = token.replace(/\r?\n/g, ";");
		token = token.replace(/\s*;\s*/g, "; ");
		token = token.replace(/;{2,}/g, ";");
		return token.trim();
	}

	private readCookieValue(cookieHeader: string, key: string): string | null {
		if (!cookieHeader) return null;
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]+)`, "i");
		const match = cookieHeader.match(regex);
		if (!match?.[1]) return null;
		const rawValue = match[1].trim();
		try {
			return decodeURIComponent(rawValue);
		} catch {
			return rawValue;
		}
	}

	private parseCookieHeader(cookieHeader: string): Map<string, string> {
		const cookies = new Map<string, string>();
		for (const part of cookieHeader.split(";")) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const separatorIndex = trimmed.indexOf("=");
			if (separatorIndex <= 0) continue;
			const key = trimmed.slice(0, separatorIndex).trim();
			const value = trimmed.slice(separatorIndex + 1).trim();
			if (key) cookies.set(key, value);
		}
		return cookies;
	}

	private buildCombinedCookieHeader(): string {
		const cookies = this.parseCookieHeader(this.cookieHeader || this.normalizeCookieHeader(this.authToken));
		const challengeCookies = this.challengeCookies instanceof Map
			? this.challengeCookies
			: new Map<string, string>();
		for (const [key, value] of challengeCookies) {
			cookies.set(key, value);
		}
		return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
	}

	private normalizeImageUrl(rawUrl: string): string | null {
		if (!rawUrl) return null;
		const cleaned = rawUrl.trim().replace(/&amp;/g, "&");
		if (!cleaned) return null;
		if (cleaned.startsWith("data:")) return cleaned;

		let candidate = cleaned;
		if (candidate.startsWith("//")) {
			candidate = `https:${candidate}`;
		}

		try {
			const parsed = new URL(candidate);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
			if (parsed.protocol === "http:") parsed.protocol = "https:";
			return parsed.toString();
		} catch {
			return null;
		}
	}

	private isCto51HostedImage(url: string): boolean {
		try {
			const host = new URL(url).hostname.toLowerCase();
			return host.endsWith("51cto.com") || host.endsWith("51ctoimg.com");
		} catch {
			return false;
		}
	}

	private dataUriToBlob(dataUri: string): Blob {
		const match = dataUri.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
		if (!match) {
			throw new Error("Invalid data URI image");
		}

		const mimeType = match[1] || "application/octet-stream";
		const isBase64 = Boolean(match[2]);
		const data = match[3] || "";
		const bytes = isBase64
			? Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
			: new TextEncoder().encode(decodeURIComponent(data));

		return new Blob([bytes], { type: mimeType });
	}

	private async downloadImageFromUrl(url: string): Promise<Blob> {
		return (await this.resolveSourceImage(url, {
			referer: CTO51_PUBLISH_URL,
			"user-agent": CTO51_DEFAULT_USER_AGENT,
		})).blob;
	}

	private extractMessage(payload: { msg?: string; message?: string } | null | undefined, fallback: string): string {
		return payload?.msg || payload?.message || fallback;
	}

	private isRetryableNetworkError(error: unknown): boolean {
		const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
		return (
			message.includes("network connection lost")
			|| message.includes("fetch failed")
			|| message.includes("request timeout")
			|| message.includes("timeout")
			|| message.includes("econnreset")
			|| message.includes("etimedout")
			|| message.includes("tls")
		);
	}

	private async withNetworkRetry<T>(
		stage: string,
		execute: () => Promise<T>,
		maxRetries = 2,
	): Promise<T> {
		let lastError: unknown;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await execute();
			} catch (error) {
				lastError = error;
				const shouldRetry = this.isRetryableNetworkError(error);
				const hasNext = attempt < maxRetries;
				if (!shouldRetry || !hasNext) break;

				await this.tracePublish({
					stage,
					level: "warn",
					message: "Transient 51CTO network error detected, retrying request",
					metadata: {
						attempt: attempt + 1,
						nextAttempt: attempt + 2,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
				await randomDelay(500 * (attempt + 1), 1000 * (attempt + 1));
			}
		}

		throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
	}

	private isSuccessResponse(payload: { code?: unknown; status?: unknown }): boolean {
		const normalizeStatus = (value: unknown): string | null => {
			if (value === true) return "1";
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
			return null;
		};

		const code = normalizeStatus(payload.code);
		if (code !== null) return code === "0" || code === "200" || code === "success";
		const status = normalizeStatus(payload.status);
		if (status !== null) return status === "1" || status === "200" || status === "success" || status === "true";
		return false;
	}

	private describeResponse(payload: unknown): string {
		try {
			return JSON.stringify(payload).slice(0, 500);
		} catch {
			return String(payload).slice(0, 500);
		}
	}

	private parseEoBotChallengeCookies(rawHtml: string): Map<string, string> | null {
		if (!rawHtml.includes("EO_Bot_Ssid") || !rawHtml.includes("__tst_status")) {
			return null;
		}

		const statusPartsMatch = rawHtml.match(/WTKkN\s*:\s*(\d+)[\s\S]*?bOYDu\s*:\s*(\d+)[\s\S]*?wyeCN\s*:\s*(\d+)/);
		const ssidMatch = rawHtml.match(/EO_Bot_Ssid=[\s\S]*?t\s*=\s*a\[[^\]]+\]\(t\s*,\s*(\d+)\)/);
		if (!statusPartsMatch?.[1] || !statusPartsMatch[2] || !statusPartsMatch[3] || !ssidMatch?.[1]) {
			return null;
		}

		const statusValue =
			Number.parseInt(statusPartsMatch[1], 10)
			+ Number.parseInt(statusPartsMatch[2], 10)
			+ Number.parseInt(statusPartsMatch[3], 10);
		const ssidValue = ssidMatch[1];
		if (!Number.isFinite(statusValue) || !ssidValue) {
			return null;
		}

		return new Map([
			["__tst_status", `${statusValue}#`],
			["EO_Bot_Ssid", ssidValue],
		]);
	}

	private applyChallengeCookies(cookies: Map<string, string>): void {
		for (const [key, value] of cookies) {
			this.challengeCookies.set(key, value);
		}
		this.headers = this.buildHeaders();
	}

	private async requestCto51<T>(url: string, options: RequestInit = {}): Promise<T> {
		for (let attempt = 0; attempt < 2; attempt++) {
			const response = await this.request<T | string>(url, options);
			if (typeof response !== "string") {
				return response as T;
			}

			const challengeCookies = this.parseEoBotChallengeCookies(response);
			if (!challengeCookies || attempt > 0) {
				return response as T;
			}

			this.applyChallengeCookies(challengeCookies);
			await this.tracePublish({
				stage: "51cto_eo_bot_challenge_solved",
				level: "warn",
				message: "51CTO EO Bot challenge cookie calculated, retrying request",
				metadata: {
					url,
					cookieNames: [...challengeCookies.keys()],
				},
			});
		}

		throw new Error("51CTO request failed after EO Bot challenge retry");
	}

	private extractCsrfToken(html: string): string | null {
		const metaMatch = html.match(/<meta\s+[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["'][^>]*>/i)
			?? html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["'][^>]*>/i);
		return metaMatch?.[1]?.trim() || null;
	}

	private extractAccountInfoFromHtml(html: string): AccountInfo | null {
		const userMatch = html.match(/<li\s+class=["'][^"']*\buser\b[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
		const profileUrl = userMatch?.[1]?.trim();
		const avatar = userMatch?.[2]?.trim();
		if (!profileUrl) return null;

		let userId = "";
		try {
			const parsed = new URL(profileUrl, CTO51_BASE_URL);
			userId = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
		} catch {
			userId = profileUrl.split("/").filter(Boolean).pop() ?? "";
		}

		if (!userId) return null;
		return {
			id: userId,
			name: userId,
			avatar: avatar?.startsWith("//") ? `https:${avatar}` : avatar,
			isLogin: true,
		};
	}

	private async fetchPublishPage(): Promise<string> {
		const html = await this.withNetworkRetry(
			"51cto_publish_page_retry",
			async () => await this.requestCto51<string>(CTO51_PUBLISH_URL, {
				method: "GET",
				headers: {
					accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"x-requested-with": "",
				},
			}),
			2,
		);
		if (typeof html !== "string") {
			throw new Error("51CTO publish page response is invalid");
		}
		return html;
	}

	private async ensureCsrfToken(): Promise<string> {
		if (this.csrfTokenCache) return this.csrfTokenCache;
		let csrfToken: string | null = null;
		let source: "publish_page" | "cookie" = "publish_page";
		try {
			const html = await this.fetchPublishPage();
			csrfToken = this.extractCsrfToken(html);
		} catch (error) {
			if (!this.cookieCsrfToken) {
				throw error;
			}
		}
		if (!csrfToken) {
			csrfToken = this.cookieCsrfToken;
			source = "cookie";
		}
		if (!csrfToken) {
			throw new Error("Missing 51CTO CSRF token. Please refresh the 51CTO login cookie.");
		}
		this.csrfTokenCache = csrfToken;
		await this.tracePublish({
			stage: "51cto_csrf_token_resolved",
			message: "Resolved 51CTO CSRF token",
			metadata: { source },
		});
		return csrfToken;
	}

	private async getUploadSign(): Promise<string> {
		const response = await this.withNetworkRetry(
			"51cto_upload_sign_retry",
			async () => await this.requestCto51<Cto51UploadSignResponse>(CTO51_UPLOAD_SIGN_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
				body: new URLSearchParams({ upload_type: "image" }).toString(),
			}),
			2,
		);

		if (!this.isSuccessResponse(response) || !response.data?.sign) {
			throw new Error(`${this.extractMessage(response, "51CTO upload sign request failed")}: ${this.describeResponse(response)}`);
		}
		return response.data.sign;
	}

	private async getUploadConfig(uploadSign: string, mimeType: string, filename: string): Promise<Cto51UploadConfigData> {
		const response = await this.withNetworkRetry(
			"51cto_upload_config_retry",
			async () => await this.requestCto51<Cto51UploadConfigResponse>(CTO51_UPLOAD_CONFIG_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
				body: new URLSearchParams({
					upload_type: "image",
					upload_sign: uploadSign,
					ext: mimeType,
					name: filename,
				}).toString(),
			}),
			2,
		);

		if (!this.isSuccessResponse(response) || !response.data?.url || !response.data.fields) {
			throw new Error(`${this.extractMessage(response, "51CTO upload config request failed")}: ${this.describeResponse(response)}`);
		}
		return {
			url: response.data.url,
			fields: response.data.fields,
		};
	}

	private pickField(fields: Record<string, string | undefined>, key: string): string | null {
		return fields[key] ?? fields[key.toLowerCase()] ?? fields[key.toUpperCase()] ?? null;
	}

	private appendRequiredCosField(formData: FormData, fields: Record<string, string | undefined>, key: string): void {
		const value = this.pickField(fields, key);
		if (!value) {
			throw new Error(`51CTO COS upload config missing field: ${key}`);
		}
		formData.append(key, value);
	}

	private buildUploadedImageUrl(key: string): string {
		const trimmed = key.trim();
		if (/^https?:\/\//i.test(trimmed)) return trimmed;
		return `https://s2.51cto.com/${trimmed.replace(/^\/+/, "")}`;
	}

	private async uploadCandidateToCto51(candidate: ResolvedImageUploadCandidate): Promise<string> {
		const uploadSign = await this.getUploadSign();
		const filename = `image-${Date.now()}.${candidate.suffix}`;
		const config = await this.getUploadConfig(uploadSign, candidate.mimeType, filename);
		const fields = config.fields;
		const objectKey = this.pickField(fields, "key");
		if (!objectKey) {
			throw new Error("51CTO COS upload config missing object key");
		}

		const formData = new FormData();
		this.appendRequiredCosField(formData, fields, "key");
		this.appendRequiredCosField(formData, fields, "policy");
		this.appendRequiredCosField(formData, fields, "x-amz-algorithm");
		this.appendRequiredCosField(formData, fields, "x-amz-signature");
		this.appendRequiredCosField(formData, fields, "x-amz-credential");
		this.appendRequiredCosField(formData, fields, "X-Amz-Date");
		formData.append("Content-Type", candidate.mimeType);
		formData.append("file", candidate.blob, filename);

		const response = await this.fetchPlatform(config.url, {
			method: "POST",
			body: formData,
		});
		if (!response.ok) {
			throw new Error(`51CTO COS image upload failed with HTTP ${response.status}`);
		}

		return this.buildUploadedImageUrl(objectKey);
	}

	private buildImageFormatRewriteSources(sourceUrl: string): string[] {
		return [
			...buildCloudinaryImageFormatRewriteSources(sourceUrl, ["jpg", "png"]),
			...buildPublicImageFormatRewriteSources(sourceUrl, ["jpg", "png"]),
		];
	}

	private async uploadImageOnce(sourceUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isCto51HostedImage(normalized)) {
			return normalized;
		}
		if (this.imageUrlCache.has(normalized)) {
			return this.imageUrlCache.get(normalized)!;
		}

		await this.tracePublish({
			stage: "51cto_image_upload_start",
			message: "Start uploading 51CTO image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const { payload: uploadedUrl, candidate } = await uploadImageWithCandidates({
			sourceUrl: normalized,
			mimeToSuffix: COMMON_IMAGE_MIME_TO_EXTENSION,
			downloadImageFromUrl: (url) => this.downloadImageFromUrl(url),
			dataUriToBlob: (dataUri) => this.dataUriToBlob(dataUri),
			buildRewriteSources: (url) => this.buildImageFormatRewriteSources(url),
			uploadCandidate: (candidate) => this.uploadCandidateToCto51(candidate),
			shouldRetryError: (error) => {
				const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
				return (
					message.includes("unsupported")
					|| message.includes("invalid file")
					|| message.includes("file type")
					|| message.includes("image type")
					|| message.includes("format")
					|| message.includes("mime")
					|| message.includes("suffix")
				);
			},
			onUseRewriteCandidate: async (candidate) => {
				await this.tracePublish({
					stage: "51cto_image_upload_retry",
					level: "warn",
					message: "Retry 51CTO image upload with converted source",
					metadata: {
						source: candidate.source,
						mimeType: candidate.mimeType,
						suffix: candidate.suffix,
					},
				});
			},
		});

		this.imageUrlCache.set(normalized, uploadedUrl);
		await this.tracePublish({
			stage: "51cto_image_upload_done",
			message: "51CTO image uploaded",
			metadata: {
				source: candidate.source.startsWith("data:") ? "data-uri" : candidate.source,
				mimeType: candidate.mimeType,
				suffix: candidate.suffix,
				uploadedUrl,
			},
		});
		return uploadedUrl;
	}

	private async uploadImageBySourceUrl(sourceUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) throw this.invalidImageSource(sourceUrl, "51CTO image upload");
		if (!normalized.startsWith("data:") && this.isCto51HostedImage(normalized)) {
			await this.verifyExistingPlatformImage(normalized, {
				referer: CTO51_PUBLISH_URL,
				"user-agent": CTO51_DEFAULT_USER_AGENT,
			});
			return normalized;
		}
		const cached = this.imageUrlCache.get(normalized);
		if (cached) return cached;
		const uploadedUrl = await this.withPlatformImageUploadRetry({
			source: normalized,
			upload: async () => await this.uploadImageOnce(normalized),
			getUploadedUrl: (url) => url,
			isExpectedPlatformUrl: (url) => this.isCto51HostedImage(url),
			verificationHeaders: {
				referer: CTO51_PUBLISH_URL,
				"user-agent": CTO51_DEFAULT_USER_AGENT,
			},
		});
		this.imageUrlCache.set(normalized, uploadedUrl);
		return uploadedUrl;
	}

	private resolveTagsValue(article: SharedArticle): string {
		const rawTags = article.tags as unknown;
		if (Array.isArray(rawTags)) {
			return [...new Set(rawTags.map((tag) => String(tag).trim()).filter(Boolean))].join(",");
		}
		if (typeof rawTags === "string") {
			return rawTags.trim();
		}
		return "";
	}

	private resolveSummaryValue(article: SharedArticle): string {
		return typeof article.summary === "string" ? article.summary.trim() : "";
	}

	private firstContentImageUrl(content: Cto51ResolvedContent): string | null {
		for (const source of this.extractImageUrlsFromMarkdownContent(content.markdownContent)) {
			const normalized = this.normalizeImageUrl(source);
			if (normalized) return normalized;
		}
		return null;
	}

	private async resolveCoverImageUrl(article: SharedArticle, content: Cto51ResolvedContent): Promise<string> {
		const rawCover = article.coverImage?.trim();
		const normalizedCover = rawCover ? this.normalizeImageUrl(rawCover) : null;
		if (rawCover && !normalizedCover) throw this.invalidImageSource(rawCover, "51CTO cover image");
		const source = normalizedCover ?? this.firstContentImageUrl(content);
		if (!source) {
			throw new Error("51CTO publish requires a cover image. Please set article.coverImage.");
		}

		await this.tracePublish({
			stage: "51cto_cover_resolve_start",
			message: "Start resolving 51CTO cover image",
			metadata: {
				source: source.startsWith("data:") ? "data-uri" : source,
				fromArticleCover: Boolean(normalizedCover),
			},
		});

		if (!source.startsWith("data:") && this.isCto51HostedImage(source)) {
			await this.verifyExistingPlatformImage(source, {
				referer: CTO51_PUBLISH_URL,
				"user-agent": CTO51_DEFAULT_USER_AGENT,
			});
			await this.tracePublish({
				stage: "51cto_cover_resolve_done",
				message: "51CTO cover image already hosted on 51CTO",
				metadata: {
					coverUrl: source,
				},
			});
			return source;
		}

		const uploadedUrl = await this.uploadImageBySourceUrl(source);
		await this.tracePublish({
			stage: "51cto_cover_resolve_done",
			message: "51CTO cover image uploaded",
			metadata: {
				coverUrl: uploadedUrl,
			},
		});
		return uploadedUrl;
	}

	private async resolveArticleContent(article: SharedArticle): Promise<Cto51ResolvedContent> {
		let markdown = convertHtmlTagsToMarkdown(
			applyMarkdownContentSlots(article.content?.trim() ?? "", article),
			{ normalizeUrl: (rawUrl) => this.normalizeImageUrl(rawUrl) },
		);
		if (!markdown) {
			throw new Error("Article markdown content is empty, cannot publish to 51CTO");
		}

		await this.tracePublish({
			stage: "51cto_resolve_content_start",
			message: "Start resolving 51CTO markdown content",
			metadata: {
				contentLength: markdown.length,
				hasCoverImage: Boolean(article.coverImage?.trim()),
			},
		});

		const imageSources = this.extractImageUrlsFromMarkdownContent(markdown);
		if (imageSources.length > 0) {
			await this.tracePublish({
				stage: "51cto_content_images_scan",
				message: "Scan 51CTO content images",
				metadata: { imageCount: imageSources.length },
			});
		}

		for (const source of imageSources) {
			const normalized = this.normalizeImageUrl(source);
			if (!normalized) throw this.invalidImageSource(source, "51CTO article content");
			if (!normalized.startsWith("data:") && this.isCto51HostedImage(normalized)) {
				await this.verifyExistingPlatformImage(normalized, {
					referer: CTO51_PUBLISH_URL,
					"user-agent": CTO51_DEFAULT_USER_AGENT,
				});
				continue;
			}
			if (this.imageUrlCache.has(normalized)) continue;

			const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
			this.imageUrlCache.set(normalized, uploadedUrl);
			await randomDelay(120, 280);
		}
		this.assertImageSourcesResolved({
			sources: imageSources,
			normalize: (source) => this.normalizeImageUrl(source),
			isPlatformHosted: (source) => this.isCto51HostedImage(source),
			resolved: this.imageUrlCache,
			context: "51CTO article content",
		});

		markdown = this.replaceMarkdownImageUrlsByMap(
			markdown,
			(rawUrl) => this.normalizeImageUrl(rawUrl),
			this.imageUrlCache,
		);
		markdown = normalizeMarkdownImageSyntax(markdown, {
			normalizeUrl: (rawUrl) => this.normalizeImageUrl(rawUrl),
			resolveUrl: (normalizedUrl) => this.imageUrlCache.get(normalizedUrl),
		});
		this.assertFinalImageSources({
			sources: this.extractImageUrlsFromMarkdownContent(markdown),
			normalize: (source) => this.normalizeImageUrl(source),
			isPlatformHosted: (source) => this.isCto51HostedImage(source),
			context: "51CTO final markdown",
		});

		await this.tracePublish({
			stage: "51cto_resolve_content_done",
			message: "51CTO markdown content resolved",
			metadata: {
				markdownLength: markdown.length,
				replacedImages: this.imageUrlCache.size,
			},
		});

		return { markdownContent: markdown };
	}

	private buildArticleParams(params: {
		article: SharedArticle;
		content: Cto51ResolvedContent;
		csrfToken: string;
		coverImageUrl: string;
		draftId?: string;
	}): URLSearchParams {
		const body = new URLSearchParams({
			title: params.article.title.trim(),
			content: params.content.markdownContent,
			pid: CTO51_DEFAULT_PUBLISH_PID,
			cate_id: CTO51_DEFAULT_PUBLISH_CATEGORY_ID,
			custom_id: "0",
			tag: this.resolveTagsValue(params.article),
			abstract: this.resolveSummaryValue(params.article),
			banner_type: "1",
			blog_type: "1",
			copy_code: "1",
			is_hide: "0",
			top_time: "",
			is_comment: "0",
			is_old: "0",
			blog_id: "",
			did: params.draftId ?? "",
			work_id: "",
			class_id: "",
			subjectId: "1",
			import_type: "",
			invite_code: "",
			raffle: "",
			orig: "",
			_csrf: params.csrfToken,
			toolsIds: "",
			check: "1",
		});
		body.append("img_urls[]", params.coverImageUrl);
		return body;
	}

	private buildDraftParams(params: {
		article: SharedArticle;
		content: Cto51ResolvedContent;
		csrfToken: string;
		coverImageUrl: string;
	}): URLSearchParams {
		return this.buildArticleParams(params);
	}

	private buildPublishParams(params: {
		article: SharedArticle;
		content: Cto51ResolvedContent;
		csrfToken: string;
		draftId: string;
		coverImageUrl: string;
	}): URLSearchParams {
		return this.buildArticleParams(params);
	}

	private extractDraftId(response: Cto51DraftResponse): string | null {
		const rawId = response.data?.did ?? response.data?.id ?? response.data?.blog_id;
		if (typeof rawId === "number" && Number.isFinite(rawId)) return String(rawId);
		if (typeof rawId === "string" && rawId.trim()) return rawId.trim();
		return null;
	}

	private async saveDraft(article: SharedArticle, content: Cto51ResolvedContent): Promise<{ id: string; url: string }> {
		const csrfToken = await this.ensureCsrfToken();
		const coverImageUrl = await this.resolveCoverImageUrl(article, content);
		const body = this.buildDraftParams({
			article,
			content,
			csrfToken,
			coverImageUrl,
		});

		await this.tracePublish({
			stage: "51cto_article_draft_request",
			message: "Submit 51CTO draft request",
			metadata: {
				pid: CTO51_DEFAULT_PUBLISH_PID,
				cateId: CTO51_DEFAULT_PUBLISH_CATEGORY_ID,
				bannerType: "1",
				subjectId: "1",
				check: "1",
				coverImageUrl,
			},
		});

		const response = await this.withNetworkRetry(
			"51cto_draft_save_retry",
			async () => await this.requestCto51<Cto51DraftResponse>(CTO51_DRAFT_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
				body: body.toString(),
			}),
			2,
		);

		if (!this.isSuccessResponse(response)) {
			throw new Error(`${this.extractMessage(response, "51CTO draft creation failed")}: ${this.describeResponse(response)}`);
		}

		const draftId = this.extractDraftId(response);
		if (!draftId) {
			throw new Error(`51CTO draft creation returned invalid payload: ${JSON.stringify(response).slice(0, 220)}`);
		}

		const url = response.data?.url?.trim() || `${CTO51_DRAFT_URL}/${encodeURIComponent(draftId)}`;
		return { id: draftId, url };
	}

	private resolvePublishedUrl(publishId: string): string {
		return `${CTO51_BASE_URL}/${CTO51_DEFAULT_USER_BLOG_PATH}/${encodeURIComponent(publishId)}`;
	}

	private async publishDraft(article: SharedArticle, content: Cto51ResolvedContent, draftId: string): Promise<{
		publishId: string;
		url: string;
	}> {
		const csrfToken = await this.ensureCsrfToken();
		const coverImageUrl = await this.resolveCoverImageUrl(article, content);
		const body = this.buildPublishParams({
			article,
			content,
			csrfToken,
			draftId,
			coverImageUrl,
		});

		await this.tracePublish({
			stage: "51cto_article_publish_delay",
			message: "Wait before submitting 51CTO publish request",
			metadata: {
				draftId,
				delayMs: 3000,
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 3000));

		await this.tracePublish({
			stage: "51cto_article_publish_request",
			message: "Submit 51CTO publish request",
			metadata: {
				draftId,
				pid: CTO51_DEFAULT_PUBLISH_PID,
				cateId: CTO51_DEFAULT_PUBLISH_CATEGORY_ID,
				bannerType: "1",
				subjectId: "1",
				check: "1",
				coverImageUrl,
			},
		});

		const response = await this.withNetworkRetry(
			"51cto_article_publish_retry",
			async () => await this.requestCto51<Cto51PublishResponse>(CTO51_PUBLISH_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
				body: body.toString(),
			}),
			2,
		);

		if (!this.isSuccessResponse(response)) {
			throw new Error(`${this.extractMessage(response, "51CTO publish failed")}: ${this.describeResponse(response)}`);
		}

		const publishId = this.extractDraftId(response) ?? draftId;
		return {
			publishId,
			url: this.resolvePublishedUrl(publishId),
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			await this.ensureCsrfToken();
			return {
				valid: true,
				message: "51CTO account verified successfully",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "51CTO account verification failed",
			};
		}
	}

	async status(): Promise<AccountStatus> {
		const result = await this.verify();
		return {
			isActive: result.valid,
			isVerified: result.valid,
			lastVerifiedAt: Date.now(),
			message: result.message,
		};
	}

	async info(): Promise<AccountInfo> {
		const html = await this.fetchPublishPage();
		const csrfToken = this.extractCsrfToken(html);
		if (csrfToken) {
			this.csrfTokenCache = csrfToken;
		}

		const accountInfo = this.extractAccountInfoFromHtml(html);
		if (!accountInfo) {
			throw new Error("51CTO login session is invalid or expired");
		}
		return accountInfo;
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "51cto_article_draft_start",
				message: "Start creating 51CTO draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
				},
			});

			const content = await this.resolveArticleContent(article);
			const draft = await this.saveDraft(article, content);
			this.draftContentCache.set(draft.id, content);

			await this.tracePublish({
				stage: "51cto_article_draft_done",
				message: "51CTO draft created",
				metadata: {
					draftId: draft.id,
					draftUrl: draft.url,
				},
			});

			return {
				id: draft.id,
				title: article.title,
				content: content.markdownContent,
				createdAt: Date.now(),
				url: draft.url,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "51cto_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "51CTO draft creation failed",
			});
			throw (error instanceof Error ? error : new Error(String(error)));
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		if (!draftId) {
			return {
				success: false,
				message: "Missing draftId for 51CTO publish",
			};
		}

		try {
			await this.tracePublish({
				stage: "51cto_article_publish_start",
				message: "Start publishing 51CTO draft",
				metadata: {
					draftId,
					hasDraftCache: this.draftContentCache.has(draftId),
				},
			});

			const content = this.draftContentCache.get(draftId) ?? await this.resolveArticleContent(article);
			const result = await this.publishDraft(article, content, draftId);

			await this.tracePublish({
				stage: "51cto_article_publish_done",
				message: "51CTO article published",
				metadata: {
					draftId,
					publishId: result.publishId,
					publishedUrl: result.url,
				},
			});

			return {
				success: true,
				articleId: result.publishId,
				url: result.url,
				message: "51CTO article published",
			};
		} catch (error) {
			await this.tracePublish({
				stage: "51cto_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "51CTO publish failed",
			});
			return {
				success: false,
				articleId: draftId,
				url: `${CTO51_DRAFT_URL}/${encodeURIComponent(draftId)}`,
				message: error instanceof Error ? error.message : "51CTO publish failed",
			};
		} finally {
			this.draftContentCache.delete(draftId);
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: false, message: "51CTO API delete is not implemented in this integration." };
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		void page;
		void pageSize;
		return [];
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		void articleId;
		return null;
	}

	async articleTags(articleId: string): Promise<string[]> {
		void articleId;
		return [];
	}

	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		void filename;
		try {
			if (!imageData?.trim()) {
				return { success: false, message: "Image data is empty" };
			}

			const normalized = this.normalizeImageUrl(imageData);
			if (normalized && !normalized.startsWith("data:")) {
				const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
				return { success: true, url: uploadedUrl, message: "Image uploaded successfully" };
			}

			const source = normalized?.startsWith("data:")
				? normalized
				: `data:image/jpeg;base64,${imageData.trim()}`;
			const uploadedUrl = await this.uploadImageBySourceUrl(source);
			return { success: true, url: uploadedUrl, message: "Image uploaded successfully" };
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Image upload failed",
			};
		}
	}
}

registerAccountService("51cto", Cto51AccountService);
