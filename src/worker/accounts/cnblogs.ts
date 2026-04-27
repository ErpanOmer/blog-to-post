import { AbstractAccountService } from "@/worker/accounts/abstract";
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
import type { Article as SharedArticle } from "@/shared/types";
import { randomDelay } from "@/worker/utils/helpers";
import { applyMarkdownContentSlots } from "@/worker/utils/content-slots";

interface CnblogsResolvedContent {
	markdownContent: string;
}

type CnblogsPostResponse = Record<string, unknown>;

const CNBLOGS_HOME_USERINFO_URL = "https://home.cnblogs.com/user/CurrentUserInfo";
const CNBLOGS_EDIT_PAGE_URL = "https://i.cnblogs.com/posts/edit";
const CNBLOGS_POSTS_API_URL = "https://i.cnblogs.com/api/posts";
const CNBLOGS_UPLOAD_IMAGE_URL = "https://upload.cnblogs.com/v2/images/cors-upload";
const CNBLOGS_EDITOR_REFERER = "https://i.cnblogs.com/";

export default class CnblogsAccountService extends AbstractAccountService {
	private imageUrlCache = new Map<string, string>();
	private draftContentCache = new Map<string, CnblogsResolvedContent>();
	private xsrfTokenCache: string | null = null;
	private userNameCache: string | null = null;

	constructor(authToken: string) {
		super("cnblogs", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			cookie: this.normalizeCookieHeader(this.authToken),
			origin: "https://i.cnblogs.com",
			referer: CNBLOGS_EDITOR_REFERER,
			accept: "*/*",
			"user-agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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

	private async ensureXsrfToken(): Promise<string | null> {
		if (this.xsrfTokenCache) {
			return this.xsrfTokenCache;
		}

		const cookieHeader = this.normalizeCookieHeader(this.authToken);
		const cookieToken =
			this.readCookieValue(cookieHeader, "XSRF-TOKEN")
			?? this.readCookieValue(cookieHeader, "__RequestVerificationToken");
		if (cookieToken) {
			this.xsrfTokenCache = cookieToken;
			return cookieToken;
		}

		try {
			const response = await fetch(CNBLOGS_EDIT_PAGE_URL, {
				method: "GET",
				headers: this.buildHeaders(),
				redirect: "follow",
			});
			const setCookie = response.headers.get("set-cookie") ?? "";
			const headerToken =
				this.readCookieValue(setCookie, "XSRF-TOKEN")
				?? this.readCookieValue(setCookie, "__RequestVerificationToken");
			if (headerToken) {
				this.xsrfTokenCache = headerToken;
				return headerToken;
			}

			const htmlText = await response.text();
			const metaMatch = htmlText.match(
				/name=["']x-xsrf-token["'][^>]*content=["']([^"']+)["']/i,
			);
			const scriptMatch = htmlText.match(/["']x-xsrf-token["']\s*:\s*["']([^"']+)["']/i);
			const htmlToken = metaMatch?.[1]?.trim() || scriptMatch?.[1]?.trim() || null;
			if (htmlToken) {
				this.xsrfTokenCache = htmlToken;
				return htmlToken;
			}
		} catch {
			// ignore and fallback null
		}

		return null;
	}

	private extractUserNameFromCurrentUserHtml(html: string): string | null {
		const profileMatch =
			html.match(/href=["']\/u\/([^/"']+)\/["']/i)
			?? html.match(/\/u\/([^/"']+)\/?/i);
		return profileMatch?.[1]?.trim() || null;
	}

	private normalizeAvatarUrl(rawUrl: string | undefined): string | undefined {
		if (!rawUrl) return undefined;
		const cleaned = rawUrl.trim();
		if (!cleaned) return undefined;
		if (cleaned.startsWith("//")) {
			return `https:${cleaned}`;
		}
		return cleaned;
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

	private isCnblogsHostedImage(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname.includes("cnblogs.com") || hostname.includes("cnblogs.cn");
		} catch {
			return false;
		}
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

	private async downloadImageFromUrl(url: string): Promise<Blob> {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
				referer: CNBLOGS_EDITOR_REFERER,
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
			// ignore
		}

		return "jpg";
	}

	private tryParseJson(raw: string): unknown | null {
		if (!raw) return null;
		try {
			return JSON.parse(raw) as unknown;
		} catch {
			return null;
		}
	}

	private toRecord(value: unknown): Record<string, unknown> | null {
		if (!value || typeof value !== "object") {
			return null;
		}
		return value as Record<string, unknown>;
	}

	private pickString(record: Record<string, unknown> | null, key: string): string | null {
		const value = record?.[key];
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed ? trimmed : null;
	}

	private pickPostId(record: Record<string, unknown> | null): string | null {
		if (!record) return null;

		const directId = record.id;
		if (typeof directId === "number" && Number.isFinite(directId)) {
			return String(directId);
		}
		if (typeof directId === "string" && directId.trim()) {
			return directId.trim();
		}

		const postId = record.postId;
		if (typeof postId === "number" && Number.isFinite(postId)) {
			return String(postId);
		}
		if (typeof postId === "string" && postId.trim()) {
			return postId.trim();
		}

		const dataRecord = this.toRecord(record.data);
		const nestedId = dataRecord?.id;
		if (typeof nestedId === "number" && Number.isFinite(nestedId)) {
			return String(nestedId);
		}
		if (typeof nestedId === "string" && nestedId.trim()) {
			return nestedId.trim();
		}

		return null;
	}

	private resolvePublishedUrl(
		record: Record<string, unknown> | null,
		postId: string,
	): string {
		const directPostUrl = this.pickString(record, "postUrl");
		const directUrl = this.pickString(record, "url");
		const nestedData = this.toRecord(record?.data);
		const nestedPostUrl = this.pickString(nestedData, "postUrl");
		const nestedUrl = this.pickString(nestedData, "url");
		const entryName = this.pickString(record, "entryName") ?? this.pickString(nestedData, "entryName");

		const candidates = [directPostUrl, directUrl, nestedPostUrl, nestedUrl].filter(
			(item): item is string => Boolean(item),
		);

		for (const item of candidates) {
			const trimmed = item.trim();
			if (trimmed.startsWith("//")) {
				return `https:${trimmed}`;
			}
			if (/^https?:\/\//i.test(trimmed)) {
				return trimmed;
			}
			if (trimmed.startsWith("/")) {
				return `https://www.cnblogs.com${trimmed}`;
			}
		}

		const userName = this.userNameCache?.trim();
		if (entryName && userName) {
			return `https://www.cnblogs.com/${userName}/p/${entryName}.html`;
		}
		if (userName) {
			return `https://www.cnblogs.com/${userName}/p/${postId}.html`;
		}

		return `https://i.cnblogs.com/articles/edit;postId=${postId}`;
	}

	private resolveDescriptionValue(article: SharedArticle): string {
		if (typeof article.summary !== "string") return "";
		return article.summary.trim();
	}

	private resolveTagsValue(article: SharedArticle): string[] {
		const rawTags = article.tags as unknown;
		if (Array.isArray(rawTags)) {
			const normalized = rawTags
				.map((tag) => (typeof tag === "string" ? tag.trim() : ""))
				.filter((tag) => tag.length > 0);
			return [...new Set(normalized)];
		}
		if (typeof rawTags === "string") {
			const normalized = rawTags
				.split(/[,\uFF0C\u3001|]/)
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0);
			return [...new Set(normalized)];
		}
		return [];
	}

	private resolveFeaturedImageValue(article: SharedArticle): string | null {
		if (!article.coverImage) return null;
		return this.normalizeImageUrl(article.coverImage) ?? null;
	}

	private buildPostPayload(params: {
		title: string;
		content: CnblogsResolvedContent;
		mode: "draft" | "publish";
		description: string;
		tags: string[];
		featuredImage: string | null;
		draftId?: string;
	}): Record<string, unknown> {
		const isPublish = params.mode === "publish";
		const rawDraftId = params.draftId?.trim();
		const numericDraftId = rawDraftId && /^\d+$/.test(rawDraftId)
			? Number.parseInt(rawDraftId, 10)
			: null;

		return {
			id: isPublish ? (numericDraftId ?? rawDraftId ?? null) : null,
			postType: 2,
			accessPermission: 0,
			title: params.title,
			url: null,
			postBody: params.content.markdownContent,
			categoryIds: null,
			categories: null,
			collectionIds: [],
			inSiteCandidate: false,
			inSiteHome: false,
			siteCategoryId: null,
			blogTeamIds: null,
			isPublished: isPublish,
			displayOnHomePage: isPublish,
			isAllowComments: true,
			includeInMainSyndication: isPublish,
			isPinned: false,
			showBodyWhenPinned: false,
			isOnlyForRegisterUser: false,
			isUpdateDateAdded: false,
			entryName: null,
			description: params.description || null,
			featuredImage: params.featuredImage,
			tags: params.tags.length > 0 ? params.tags : null,
			password: null,
			publishAt: null,
			datePublished: new Date().toISOString(),
			dateUpdated: null,
			isMarkdown: true,
			isDraft: !isPublish,
			autoDesc: null,
			changePostType: false,
			blogId: 0,
			author: null,
			removeScript: false,
			clientInfo: null,
			changeCreatedTime: false,
			canChangeCreatedTime: false,
			isContributeToImpressiveBugActivity: false,
			usingEditorId: 5,
			sourceUrl: null,
		};
	}

	private async requestWithXsrf<T>(
		url: string,
		method: "POST" | "PUT",
		body: Record<string, unknown>,
	): Promise<T> {
		const xsrfToken = await this.ensureXsrfToken();
		if (!xsrfToken) {
			throw new Error(
				"Missing XSRF token. Please provide full cnblogs cookies including XSRF-TOKEN.",
			);
		}

		return await this.request<T>(url, {
			method,
			headers: {
				"x-xsrf-token": xsrfToken,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
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
				const retryable = this.isRetryableNetworkError(error);
				const hasNext = attempt < maxRetries;
				if (!retryable || !hasNext) break;

				await this.tracePublish({
					stage,
					level: "warn",
					message: "Transient network error detected, retrying request",
					metadata: {
						attempt: attempt + 1,
						nextAttempt: attempt + 2,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
				await randomDelay(500 * (attempt + 1), 900 * (attempt + 1));
			}
		}

		throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
	}

	private async uploadImageBySourceUrl(sourceUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isCnblogsHostedImage(normalized)) {
			return normalized;
		}

		const xsrfToken = await this.ensureXsrfToken();
		if (!xsrfToken) {
			throw new Error(
				"Missing XSRF token. Please provide full cnblogs cookies including XSRF-TOKEN.",
			);
		}

		await this.tracePublish({
			stage: "cnblogs_image_upload_start",
			message: "Start uploading cnblogs image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const blob = normalized.startsWith("data:")
			? this.dataUriToBlob(normalized)
			: await this.downloadImageFromUrl(normalized);
		const suffix = this.guessImageSuffix(normalized, blob.type || "image/jpeg");

		const formData = new FormData();
		formData.append("image", blob, `image.${suffix}`);
		formData.append("app", "blog");
		formData.append("uploadType", "Select");

		const response = await fetch(CNBLOGS_UPLOAD_IMAGE_URL, {
			method: "POST",
			headers: {
				cookie: this.normalizeCookieHeader(this.authToken),
				origin: "https://i.cnblogs.com",
				referer: CNBLOGS_EDITOR_REFERER,
				"x-xsrf-token": xsrfToken,
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				accept: "*/*",
			},
			body: formData,
		});

		const rawText = await response.text();
		if (!response.ok) {
			throw new Error(`Cnblogs image upload failed (${response.status}): ${rawText.slice(0, 220)}`);
		}

		const payload = this.toRecord(this.tryParseJson(rawText));
		const nestedData = this.toRecord(payload?.data);
		const uploadedCandidate = (
			(typeof payload?.data === "string" ? payload.data : null)
			|| this.pickString(payload, "url")
			|| this.pickString(payload, "imageUrl")
			|| this.pickString(payload, "src")
			|| this.pickString(nestedData, "url")
			|| this.pickString(nestedData, "imageUrl")
			|| this.pickString(nestedData, "src")
		);

		const uploadedUrl = uploadedCandidate ? this.normalizeImageUrl(uploadedCandidate) : null;
		if (!uploadedUrl) {
			throw new Error(`Cnblogs image upload returned invalid payload: ${rawText.slice(0, 220)}`);
		}

		await this.tracePublish({
			stage: "cnblogs_image_upload_done",
			message: "Cnblogs image uploaded",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
				uploadedUrl,
			},
		});

		return uploadedUrl;
	}

	private async resolveArticleContent(article: SharedArticle): Promise<CnblogsResolvedContent> {
		const markdown = applyMarkdownContentSlots(article.content?.trim() ?? "", article);
		if (!markdown) {
			throw new Error("Article markdown content is empty, cannot publish to cnblogs");
		}

		const imageSources = this.extractImageUrlsFromMarkdownContent(markdown);
		for (const source of imageSources) {
			const normalized = this.normalizeImageUrl(source);
			if (!normalized) continue;
			if (!normalized.startsWith("data:") && this.isCnblogsHostedImage(normalized)) continue;
			if (this.imageUrlCache.has(normalized)) continue;

			try {
				const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
				this.imageUrlCache.set(normalized, uploadedUrl);
				await randomDelay(120, 300);
			} catch (error) {
				await this.tracePublish({
					stage: "cnblogs_resolve_single_image_failed",
					level: "warn",
					message: "Image upload failed, keep original source",
					metadata: {
						source: normalized,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
			}
		}

		const replacedMarkdown = this.replaceMarkdownImageUrlsByMap(
			markdown,
			(rawUrl) => this.normalizeImageUrl(rawUrl),
			this.imageUrlCache,
		);

		return {
			markdownContent: replacedMarkdown,
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "Cnblogs account verified successfully",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "Cnblogs account verification failed",
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
		const html = await this.request<string>(CNBLOGS_HOME_USERINFO_URL, {
			method: "GET",
			headers: {
				accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			},
		});

		if (typeof html !== "string") {
			throw new Error("Cnblogs user info response is invalid");
		}

		const userName = this.extractUserNameFromCurrentUserHtml(html);
		if (!userName) {
			throw new Error("Cnblogs login session is invalid or expired");
		}
		this.userNameCache = userName;

		const avatarMatch = html.match(/<img[^>]+class=["']pfs["'][^>]+src=["']([^"']+)["']/i);
		const avatar = this.normalizeAvatarUrl(avatarMatch?.[1]);

		return {
			id: userName,
			name: userName,
			avatar,
			isLogin: true,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "cnblogs_article_draft_start",
				message: "Start creating cnblogs draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
				},
			});

			const content = await this.resolveArticleContent(article);
			const payload = this.buildPostPayload({
				title: article.title,
				content,
				mode: "draft",
				description: this.resolveDescriptionValue(article),
				tags: this.resolveTagsValue(article),
				featuredImage: this.resolveFeaturedImageValue(article),
			});

			const data = await this.withNetworkRetry(
				"cnblogs_article_draft_retry",
				async () => await this.requestWithXsrf<CnblogsPostResponse>(
					CNBLOGS_POSTS_API_URL,
					"POST",
					payload,
				),
				2,
			);

			const record = this.toRecord(data);
			const draftId = this.pickPostId(record);
			if (!draftId) {
				throw new Error("Cnblogs draft creation returned invalid id");
			}

			this.draftContentCache.set(draftId, content);
			const draftUrl = `https://i.cnblogs.com/articles/edit;postId=${draftId}`;

			await this.tracePublish({
				stage: "cnblogs_article_draft_done",
				message: "Cnblogs draft created",
				metadata: {
					draftId,
					draftUrl,
				},
			});

			return {
				id: draftId,
				title: article.title,
				content: content.markdownContent,
				createdAt: Date.now(),
				url: draftUrl,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "cnblogs_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Cnblogs draft creation failed",
			});
			throw (error instanceof Error ? error : new Error(String(error)));
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		try {
			if (!draftId) {
				return {
					success: false,
					message: "Cnblogs publish requires draftId. Please create a draft first.",
				};
			}

			await this.tracePublish({
				stage: "cnblogs_article_publish_start",
				message: "Start publishing cnblogs article",
				metadata: {
					draftId,
				},
			});

			let content = this.draftContentCache.get(draftId);
			if (!content) {
				content = await this.resolveArticleContent(article);
			}

			const payload = this.buildPostPayload({
				title: article.title,
				content,
				mode: "publish",
				description: this.resolveDescriptionValue(article),
				tags: this.resolveTagsValue(article),
				featuredImage: this.resolveFeaturedImageValue(article),
				draftId,
			});

			const data = await this.withNetworkRetry(
				"cnblogs_article_publish_retry",
				async () => await this.requestWithXsrf<CnblogsPostResponse>(
					CNBLOGS_POSTS_API_URL,
					"POST",
					payload,
				),
				2,
			);

			const record = this.toRecord(data);
			const publishId = this.pickPostId(record) ?? draftId;
			const publishedUrl = this.resolvePublishedUrl(record, publishId);

			await this.tracePublish({
				stage: "cnblogs_article_publish_done",
				message: "Cnblogs article published",
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
				stage: "cnblogs_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Cnblogs publish failed",
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "Cnblogs publish failed",
			};
		} finally {
			if (draftId) {
				this.draftContentCache.delete(draftId);
			}
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: false, message: "Cnblogs API delete is not implemented in this integration." };
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

registerAccountService("cnblogs", CnblogsAccountService);
