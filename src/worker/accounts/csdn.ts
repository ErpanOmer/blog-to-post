import { AbstractAccountService } from "@/worker/accounts/abstract";
import type { Article as SharedArticle } from "@/shared/types";
import { registerAccountService } from "@/worker/accounts/index";
import type {
	VerifyResult,
	AccountStatus,
	AccountInfo,
	ArticleDraft,
	Article,
	ArticlePublishResult,
	ImageUploadResult,
} from "@/worker/accounts/index";
import { marked } from "marked";
import { randomDelay } from "@/worker/utils/helpers";

interface CSDNBaseInfoResponse {
	code: number;
	msg?: string;
	message?: string;
	data?: {
		name?: string;
		nickname?: string;
		avatar?: string;
		blog_url?: string;
	};
}

interface CSDNSaveArticleResponse {
	code: number;
	msg?: string;
	message?: string;
	data?: {
		id?: string | number;
		url?: string;
	};
}

interface CSDNUploadSignatureResponse {
	code: number;
	msg?: string;
	message?: string;
	data?: {
		filePath?: string;
		host?: string;
		accessId?: string;
		policy?: string;
		signature?: string;
		callbackUrl?: string;
		callbackBody?: string;
		callbackBodyType?: string;
		customParam?: {
			rtype?: string;
			filePath?: string;
			isAudit?: number;
			"x-image-app"?: string;
			type?: string;
			"x-image-suffix"?: string;
			username?: string;
		};
	};
}

interface CSDNObsUploadResponse {
	code?: number;
	msg?: string;
	message?: string;
	data?: {
		imageUrl?: string;
	};
}

interface CSDNResolvedContent {
	markdownContent: string;
	htmlContent: string;
	coverImages: string[];
}

const CSDN_BIZ_API_BASE = "https://bizapi.csdn.net";
const CSDN_BASE_INFO_PATH = "/blog-console-api/v3/editor/getBaseInfo";
const CSDN_SAVE_ARTICLE_PATH = "/blog-console-api/v3/mdeditor/saveArticle";
const CSDN_UPLOAD_SIGNATURE_PATH = "/resource-api/v1/image/direct/upload/signature";
const CSDN_EDITOR_REFERER = "https://editor.csdn.net/";
const IMAGE_SRC_REGEX = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const CSDN_API_KEY = "260196572";
const CSDN_API_SECRET = "t5PaqxVQpWoHgLGt7XPIvd5ipJcwJTU7";

export default class CSDNAccountService extends AbstractAccountService {
	private imageUrlCache = new Map<string, string>();
	private draftContentCache = new Map<string, CSDNResolvedContent>();

	constructor(authToken: string) {
		super("csdn", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			cookie: this.normalizeCookieHeader(this.authToken),
			origin: "https://editor.csdn.net",
			referer: CSDN_EDITOR_REFERER,
			accept: "*/*",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		};
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

	private getMessage(payload: { msg?: string; message?: string }): string {
		return payload.msg || payload.message || "CSDN request failed";
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
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return null;
			}
			if (parsed.protocol === "http:") {
				parsed.protocol = "https:";
			}
			return parsed.toString();
		} catch {
			return null;
		}
	}

	private isCsdnHostedImage(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname.includes("csdnimg.cn")
				|| hostname.includes("csdn.net")
				|| hostname.includes("myhuaweicloud.com");
		} catch {
			return false;
		}
	}

	private extractImageUrlsFromHtml(htmlContent: string): string[] {
		const urls = new Set<string>();
		let match: RegExpExecArray | null;
		while ((match = IMAGE_SRC_REGEX.exec(htmlContent)) !== null) {
			if (match[1]) {
				urls.add(match[1]);
			}
		}
		return [...urls];
	}

	private extractImageUrlsFromMarkdown(markdownContent: string): string[] {
		const urls = new Set<string>();
		let match: RegExpExecArray | null;
		while ((match = MARKDOWN_IMAGE_REGEX.exec(markdownContent)) !== null) {
			if (match[1]) {
				urls.add(match[1]);
			}
		}
		return [...urls];
	}

	private replaceHtmlImageUrls(htmlContent: string): string {
		return htmlContent.replace(
			/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
			(fullMatch, prefix: string, src: string, suffix: string) => {
				const normalized = this.normalizeImageUrl(src);
				if (!normalized) return fullMatch;
				const replacement = this.imageUrlCache.get(normalized);
				if (!replacement) return fullMatch;
				return `${prefix}${replacement}${suffix}`;
			},
		);
	}

	private replaceMarkdownImageUrls(markdownContent: string): string {
		return markdownContent.replace(
			/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
			(fullMatch, alt: string, src: string, title: string | undefined) => {
				const normalized = this.normalizeImageUrl(src);
				if (!normalized) return fullMatch;
				const replacement = this.imageUrlCache.get(normalized);
				if (!replacement) return fullMatch;
				const titlePart = title ? ` "${title}"` : "";
				return `![${alt}](${replacement}${titlePart})`;
			},
		);
	}

	private dataUriToBlob(dataUri: string): Blob {
		const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
		if (!match) {
			throw new Error("Invalid data URI payload");
		}

		const mimeType = match[1] || "image/jpeg";
		const binary = atob(match[2]);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return new Blob([bytes], { type: mimeType });
	}

	private tryParseJson(raw: string): unknown | null {
		if (!raw) return null;
		try {
			return JSON.parse(raw) as unknown;
		} catch {
			return null;
		}
	}

	private bufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	private async hmacSha256Base64(message: string, secret: string): Promise<string> {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const messageData = encoder.encode(message);
		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
		return this.bufferToBase64(signature);
	}

	private async signRequest(apiPath: string, method: "GET" | "POST"): Promise<Record<string, string>> {
		const nonce = crypto.randomUUID();
		const signString = method === "GET"
			? `GET\n*/*\n\n\n\nx-ca-key:${CSDN_API_KEY}\nx-ca-nonce:${nonce}\n${apiPath}`
			: `POST\n*/*\n\napplication/json\n\nx-ca-key:${CSDN_API_KEY}\nx-ca-nonce:${nonce}\n${apiPath}`;
		const signature = await this.hmacSha256Base64(signString, CSDN_API_SECRET);

		const headers: Record<string, string> = {
			accept: "*/*",
			"x-ca-key": CSDN_API_KEY,
			"x-ca-nonce": nonce,
			"x-ca-signature": signature,
			"x-ca-signature-headers": "x-ca-key,x-ca-nonce",
		};

		if (method === "POST") {
			headers["Content-Type"] = "application/json";
		}

		return headers;
	}

	private async requestSigned<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
		const maxAttempts = 3;
		let lastError: unknown = null;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const headers = await this.signRequest(path, method);
				return await this.request<T>(`${CSDN_BIZ_API_BASE}${path}`, {
					method,
					headers,
					body: method === "POST" && body ? JSON.stringify(body) : undefined,
				});
			} catch (error) {
				lastError = error;
				const message = error instanceof Error ? error.message.toLowerCase() : "";
				const shouldRetry = (
					message.includes("network connection lost")
					|| message.includes("fetch failed")
					|| message.includes("econnreset")
					|| message.includes("tls")
				);

				if (!shouldRetry || attempt >= maxAttempts) {
					throw error;
				}

				await this.tracePublish({
					stage: "csdn_request_retry",
					level: "warn",
					message: "Retry CSDN request after transient network error",
					metadata: {
						path,
						method,
						attempt,
						maxAttempts,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
				await randomDelay(350, 950);
			}
		}

		throw lastError instanceof Error ? lastError : new Error("CSDN request failed");
	}

	private async downloadImageFromUrl(url: string): Promise<Blob> {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
				referer: CSDN_EDITOR_REFERER,
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok) {
			throw new Error(`Image download failed (${response.status}): ${url}`);
		}

		const blob = await response.blob();
		if (!blob.type.startsWith("image/") && blob.type !== "application/octet-stream") {
			throw new Error(`Resource is not an image: ${url}`);
		}
		return blob;
	}

	private guessImageSuffix(sourceUrl: string, mimeType: string): string {
		const typeMap: Record<string, string> = {
			"image/jpeg": "jpg",
			"image/jpg": "jpg",
			"image/png": "png",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/bmp": "bmp",
			"image/svg+xml": "svg",
		};

		const normalizedMime = mimeType.toLowerCase();
		if (typeMap[normalizedMime]) {
			return typeMap[normalizedMime];
		}

		try {
			const parsed = new URL(sourceUrl);
			const suffix = parsed.pathname.split(".").pop()?.toLowerCase();
			if (suffix && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(suffix)) {
				return suffix === "jpeg" ? "jpg" : suffix;
			}
		} catch {
			// ignore and fallback
		}

		return "jpg";
	}

	private async uploadImageBySourceUrl(sourceUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isCsdnHostedImage(normalized)) {
			return normalized;
		}

		await this.tracePublish({
			stage: "csdn_image_upload_start",
			message: "Start uploading CSDN image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const blob = normalized.startsWith("data:")
			? this.dataUriToBlob(normalized)
			: await this.downloadImageFromUrl(normalized);
		const suffix = this.guessImageSuffix(normalized, blob.type || "image/jpeg");

		const signatureData = await this.requestSigned<CSDNUploadSignatureResponse>(
			CSDN_UPLOAD_SIGNATURE_PATH,
			"POST",
			{
				imageTemplate: "",
				appName: "direct_blog_markdown",
				imageSuffix: suffix,
			},
		);

		if (signatureData.code !== 200 || !signatureData.data) {
			throw new Error(this.getMessage(signatureData));
		}

		const uploadData = signatureData.data;
		const customParam = uploadData.customParam;
		if (
			!uploadData.filePath
			|| !uploadData.host
			|| !uploadData.accessId
			|| !uploadData.policy
			|| !uploadData.signature
			|| !uploadData.callbackUrl
			|| !uploadData.callbackBody
			|| !uploadData.callbackBodyType
			|| !customParam?.rtype
			|| !customParam.filePath
			|| customParam.isAudit === undefined
			|| !customParam["x-image-app"]
			|| !customParam.type
			|| !customParam["x-image-suffix"]
			|| !customParam.username
		) {
			throw new Error("CSDN image upload signature payload is incomplete");
		}

		const formData = new FormData();
		formData.append("key", uploadData.filePath);
		formData.append("policy", uploadData.policy);
		formData.append("signature", uploadData.signature);
		formData.append("callbackBody", uploadData.callbackBody);
		formData.append("callbackBodyType", uploadData.callbackBodyType);
		formData.append("callbackUrl", uploadData.callbackUrl);
		formData.append("AccessKeyId", uploadData.accessId);
		formData.append("x:rtype", customParam.rtype);
		formData.append("x:filePath", customParam.filePath);
		formData.append("x:isAudit", String(customParam.isAudit));
		formData.append("x:x-image-app", customParam["x-image-app"]);
		formData.append("x:type", customParam.type);
		formData.append("x:x-image-suffix", customParam["x-image-suffix"]);
		formData.append("x:username", customParam.username);
		formData.append("file", blob, `image.${suffix}`);

		const obsResponse = await fetch(uploadData.host, {
			method: "POST",
			body: formData,
		});
		const obsRaw = await obsResponse.text();
		if (!obsResponse.ok) {
			throw new Error(`CSDN image upload failed (${obsResponse.status}): ${obsRaw.slice(0, 220)}`);
		}

		const obsPayload = this.tryParseJson(obsRaw) as CSDNObsUploadResponse | null;
		const uploadedUrl = obsPayload?.data?.imageUrl;
		if (!uploadedUrl) {
			throw new Error(`CSDN image upload returned invalid payload: ${obsRaw.slice(0, 220)}`);
		}

		await this.tracePublish({
			stage: "csdn_image_upload_done",
			message: "CSDN image uploaded",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
				uploadedUrl,
			},
		});

		return uploadedUrl;
	}

	private async resolveCoverImages(article: SharedArticle): Promise<string[]> {
		const coverImage = article.coverImage?.trim();
		if (!coverImage) return [];

		const normalized = this.normalizeImageUrl(coverImage);
		if (!normalized) {
			await this.tracePublish({
				stage: "csdn_cover_invalid",
				level: "warn",
				message: "Cover image URL is invalid, skip cover",
				metadata: { coverImage },
			});
			return [];
		}

		if (!normalized.startsWith("data:") && this.isCsdnHostedImage(normalized)) {
			return [normalized];
		}

		try {
			const uploaded = await this.uploadImageBySourceUrl(normalized);
			return [uploaded];
		} catch (error) {
			await this.tracePublish({
				stage: "csdn_cover_upload_failed",
				level: "warn",
				message: error instanceof Error ? error.message : "Cover upload failed",
				metadata: {
					source: normalized,
				},
			});
			return [];
		}
	}

	private resolveMarkdownContent(article: SharedArticle): string {
		const markdown = article.content?.trim() ?? "";
		if (!markdown) {
			throw new Error("Article markdown content is empty, cannot publish to CSDN");
		}
		return markdown;
	}

	private resolveHtmlContent(article: SharedArticle, markdownContent: string): string {
		const existingHtml = article.htmlContent?.trim();
		if (existingHtml) {
			return existingHtml;
		}
		return marked.parse(markdownContent, {
			async: false,
			gfm: true,
			breaks: false,
		}) as string;
	}

	private async resolveArticleContent(article: SharedArticle): Promise<CSDNResolvedContent> {
		await this.tracePublish({
			stage: "csdn_resolve_content_start",
			message: "Start resolving CSDN article content",
			metadata: {
				contentLength: article.content?.length ?? 0,
				hasExistingHtml: Boolean(article.htmlContent?.trim()),
				hasCoverImage: Boolean(article.coverImage?.trim()),
			},
		});

		const markdownContent = this.resolveMarkdownContent(article);
		const htmlContent = this.resolveHtmlContent(article, markdownContent);

		const imageSources = new Set<string>([
			...this.extractImageUrlsFromMarkdown(markdownContent),
			...this.extractImageUrlsFromHtml(htmlContent),
		]);

		if (imageSources.size > 0) {
			await this.tracePublish({
				stage: "csdn_resolve_images_start",
				message: "Start replacing CSDN article images",
				metadata: {
					imageCount: imageSources.size,
				},
			});

			for (const source of imageSources) {
				const normalized = this.normalizeImageUrl(source);
				if (!normalized) continue;
				if (!normalized.startsWith("data:") && this.isCsdnHostedImage(normalized)) continue;
				if (this.imageUrlCache.has(normalized)) continue;

				try {
					const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
					this.imageUrlCache.set(normalized, uploadedUrl);
					await randomDelay(200, 450);
				} catch (error) {
					await this.tracePublish({
						stage: "csdn_resolve_single_image_failed",
						level: "warn",
						message: "Image upload failed, keep original source",
						metadata: {
							source: normalized,
							error: error instanceof Error ? error.message : "unknown",
						},
					});
				}
			}
		}

		const replacedMarkdown = this.replaceMarkdownImageUrls(markdownContent);
		const replacedHtml = this.replaceHtmlImageUrls(htmlContent);
		const coverImages = await this.resolveCoverImages(article);

		await this.tracePublish({
			stage: "csdn_resolve_content_done",
			message: "CSDN article content resolved",
			metadata: {
				markdownLength: replacedMarkdown.length,
				htmlLength: replacedHtml.length,
				replacedImages: this.imageUrlCache.size,
				coverCount: coverImages.length,
			},
		});

		return {
			markdownContent: replacedMarkdown,
			htmlContent: replacedHtml,
			coverImages,
		};
	}

	private buildSaveArticleBody(params: {
		title: string;
		content: CSDNResolvedContent;
		mode: "draft" | "publish";
		description: string;
		tags: string;
		draftId?: string;
	}): Record<string, unknown> {
		const isPublish = params.mode === "publish";
		const body: Record<string, unknown> = {
			title: params.title,
			markdowncontent: params.content.markdownContent,
			content: params.content.htmlContent,
			readType: "public",
			level: 0,
			Description: params.description,
			tags: params.tags,
			status: isPublish ? 0 : 2,
			categories: "",
			type: "original",
			original_link: "",
			authorized_status: false,
			not_auto_saved: "1",
			source: "pc_mdeditor",
			cover_images: params.content.coverImages,
			cover_type: params.content.coverImages.length > 0 ? 1 : 0,
			is_new: isPublish ? 0 : 1,
			vote_id: 0,
			resource_id: "",
			pubStatus: isPublish ? "publish" : "draft",
			creator_activity_id: "",
		};

		if (isPublish && params.draftId) {
			body.id = params.draftId;
			body.article_id = params.draftId;
		}

		return body;
	}

	private resolveDescriptionValue(article: SharedArticle): string {
		if (typeof article.summary !== "string") {
			return "";
		}
		return article.summary.trim();
	}

	private resolveTagsValue(article: SharedArticle): string {
		const rawTags = article.tags as unknown;

		if (Array.isArray(rawTags)) {
			return rawTags
				.map((tag) => (typeof tag === "string" ? tag.trim() : ""))
				.filter((tag) => tag.length > 0)
				.join(",");
		}

		if (typeof rawTags === "string") {
			return rawTags.trim();
		}

		return "";
	}

	private async saveArticle(
		body: Record<string, unknown>,
	): Promise<{ id: string; url?: string }> {
		const data = await this.requestSigned<CSDNSaveArticleResponse>(
			CSDN_SAVE_ARTICLE_PATH,
			"POST",
			body,
		);

		if (data.code !== 200 || !data.data?.id) {
			throw new Error(this.getMessage(data));
		}

		return {
			id: String(data.data.id),
			url: data.data.url,
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "CSDN account verified successfully",
				accountInfo,
			};
		} catch (error) {
			const rawMessage = error instanceof Error ? error.message : "CSDN account verification failed";
			const normalized = rawMessage.toLowerCase();

			let message = rawMessage;
			if (normalized.includes("401") || normalized.includes("403") || normalized.includes("unauthorized") || normalized.includes("forbidden")) {
				message = "CSDN login session is invalid or expired. Please copy a fresh full Cookie from browser.";
			} else if (
				normalized.includes("network connection lost")
				|| normalized.includes("fetch failed")
				|| normalized.includes("econnreset")
				|| normalized.includes("tls")
			) {
				message = "Network to CSDN is unstable. Please retry.";
			}

			return {
				valid: false,
				message,
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
		const data = await this.requestSigned<CSDNBaseInfoResponse>(
			CSDN_BASE_INFO_PATH,
			"GET",
		);

		if (data.code !== 200 || !data.data?.name) {
			throw new Error(this.getMessage(data));
		}

		const userId = data.data.name;
		const userName = data.data.nickname || data.data.name;

		return {
			id: userId,
			name: userName,
			avatar: data.data.avatar,
			isLogin: true,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "csdn_article_draft_start",
				message: "Start creating CSDN draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
				},
			});

			const content = await this.resolveArticleContent(article);
			const body = this.buildSaveArticleBody({
				title: article.title,
				content,
				mode: "draft",
				description: this.resolveDescriptionValue(article),
				tags: this.resolveTagsValue(article),
			});
			const result = await this.saveArticle(body);
			const draftId = result.id;
			const draftUrl = result.url || `https://editor.csdn.net/md?articleId=${draftId}`;

			this.draftContentCache.set(draftId, content);

			await this.tracePublish({
				stage: "csdn_article_draft_done",
				message: "CSDN draft created",
				metadata: {
					draftId,
					draftUrl,
					coverCount: content.coverImages.length,
				},
			});

			return {
				id: draftId,
				title: article.title,
				content: content.markdownContent,
				htmlContent: content.htmlContent,
				createdAt: Date.now(),
				url: draftUrl,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "csdn_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "CSDN draft creation failed",
			});
			return null;
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		try {
			if (!draftId) {
				return {
					success: false,
					message: "CSDN publish requires draftId. Please create a draft first.",
				};
			}

			await this.tracePublish({
				stage: "csdn_article_publish_start",
				message: "Start publishing CSDN article",
				metadata: {
					draftId,
					hasPayloadHtmlContent: Boolean(article.htmlContent?.trim()),
				},
			});

			let content = this.draftContentCache.get(draftId);
			if (content) {
				await this.tracePublish({
					stage: "csdn_article_publish_reused",
					message: "Reuse CSDN draft payload",
					metadata: {
						draftId,
						markdownLength: content.markdownContent.length,
						htmlLength: content.htmlContent.length,
					},
				});
			} else if (article.htmlContent?.trim()) {
				const markdownContent = this.resolveMarkdownContent(article);
				const coverImages = await this.resolveCoverImages(article);
				content = {
					markdownContent,
					htmlContent: article.htmlContent.trim(),
					coverImages,
				};
			} else {
				content = await this.resolveArticleContent(article);
			}

			const body = this.buildSaveArticleBody({
				title: article.title,
				content,
				mode: "publish",
				description: this.resolveDescriptionValue(article),
				tags: this.resolveTagsValue(article),
				draftId,
			});
			const result = await this.saveArticle(body);
			const publishId = result.id || draftId;
			const publishedUrl = result.url || `https://editor.csdn.net/md?articleId=${draftId}`;

			await this.tracePublish({
				stage: "csdn_article_publish_done",
				message: "CSDN article published",
				metadata: {
					draftId,
					publishId,
					publishedUrl,
				},
			});

			return {
				success: true,
				articleId: publishId,
				message: "Publish success",
				url: publishedUrl,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "csdn_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "CSDN publish failed",
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "CSDN publish failed",
			};
		} finally {
			if (draftId) {
				this.draftContentCache.delete(draftId);
			}
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: false, message: "CSDN API does not support deleting articles in this implementation." };
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

registerAccountService("csdn", CSDNAccountService);

