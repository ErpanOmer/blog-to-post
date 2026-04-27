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

interface SegmentFaultResolvedContent {
	markdownContent: string;
	coverUrl: string | null;
}

interface SegmentFaultUploadedImage {
	contentUrl: string;
	coverUrl: string;
}

const SEGMENTFAULT_BASE_URL = "https://segmentfault.com";
const SEGMENTFAULT_GATEWAY_BASE_URL = "https://segmentfault.com/gateway";
const SEGMENTFAULT_SETTINGS_URL = "https://segmentfault.com/user/settings";
const SEGMENTFAULT_WRITE_URL = "https://segmentfault.com/write";
const SEGMENTFAULT_GATEWAY_ME_PATH = "/user/@me";
const SEGMENTFAULT_GATEWAY_DRAFT_PATH = "/draft";
const SEGMENTFAULT_GATEWAY_ARTICLE_PATH = "/article";
const SEGMENTFAULT_GATEWAY_IMAGE_PATH = "/image";
const SEGMENTFAULT_REFERER = "https://segmentfault.com/";
const SEGMENTFAULT_DEFAULT_TAG_ID = [
  1040000000089899,
  1040000000089436,
  1040000000089556,
  1040000000426368,
  1040000004271102
];

export default class SegmentFaultAccountService extends AbstractAccountService {
	private imageUrlCache = new Map<string, string>();
	private draftContentCache = new Map<string, SegmentFaultResolvedContent>();
	private tokenCache: string | null = null;
	private cookieHeader: string;

	constructor(authToken: string) {
		super("segmentfault", authToken);
		this.cookieHeader = this.normalizeCookieHeader(authToken);
	}

	protected buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			origin: SEGMENTFAULT_BASE_URL,
			referer: SEGMENTFAULT_REFERER,
			accept: "*/*",
			"user-agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		};
		if (this.cookieHeader) {
			headers.cookie = this.cookieHeader;
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
		try {
			return decodeURIComponent(match[1].trim());
		} catch {
			return match[1].trim();
		}
	}

	private isProbablyCookie(rawToken: string): boolean {
		return rawToken.includes("=") && (rawToken.includes(";") || rawToken.toLowerCase().includes("path="));
	}

	private extractDirectToken(rawToken: string): string | null {
		if (!rawToken) return null;
		const trimmed = rawToken.trim();
		if (!trimmed) return null;

		const prefixed = trimmed.match(/^token\s*[:=]\s*(.+)$/i);
		if (prefixed?.[1]) {
			return prefixed[1].trim();
		}

		if (this.isProbablyCookie(trimmed)) {
			return this.readCookieValue(trimmed, "token")
				?? this.readCookieValue(trimmed, "Token")
				?? null;
		}

		if (!/\s/.test(trimmed) && trimmed.length >= 12) {
			return trimmed;
		}

		return null;
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
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return null;
		}
		return value as Record<string, unknown>;
	}

	private toNumber(value: unknown): number | null {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	private toStringId(value: unknown): string | null {
		if (typeof value === "string" && value.trim()) return value.trim();
		const numeric = this.toNumber(value);
		if (numeric !== null) return String(numeric);
		return null;
	}

	private pickString(record: Record<string, unknown> | null, key: string): string | null {
		const value = record?.[key];
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed || null;
	}

	private extractMessage(payload: unknown): string {
		if (typeof payload === "string" && payload.trim()) return payload.trim();

		if (Array.isArray(payload)) {
			if (payload[0] === 1 && typeof payload[1] === "string" && payload[1].trim()) {
				return payload[1].trim();
			}
			const second = payload[1];
			if (typeof second === "string" && second.trim()) return second.trim();
			return "SegmentFault API request failed";
		}

		const record = this.toRecord(payload);
		return this.pickString(record, "message")
			?? this.pickString(record, "msg")
			?? this.pickString(record, "error")
			?? this.pickString(record, "errMsg")
			?? "SegmentFault API request failed";
	}

	private unwrapGatewayPayload(payload: unknown): unknown {
		if (Array.isArray(payload)) {
			if (payload.length === 0) return payload;
			const code = payload[0];
			if (code === 1) {
				throw new Error(this.extractMessage(payload));
			}
			if (code === 0 && payload.length >= 2) {
				return payload[1];
			}
		}
		return payload;
	}

	private normalizeImageUrl(rawUrl: string): string | null {
		if (!rawUrl) return null;
		const cleaned = rawUrl.trim().replace(/&amp;/g, "&");
		if (!cleaned) return null;
		if (cleaned.startsWith("data:")) return cleaned;
		if (cleaned.startsWith("/")) return `${SEGMENTFAULT_BASE_URL}${cleaned}`;

		let candidate = cleaned;
		if (candidate.startsWith("//")) {
			candidate = `https:${candidate}`;
		}

		try {
			const parsed = new URL(candidate);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return null;
			}
			if (parsed.protocol === "http:") parsed.protocol = "https:";
			return parsed.toString();
		} catch {
			return null;
		}
	}

	private isSegmentFaultHostedImage(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname.includes("segmentfault.com");
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
				referer: SEGMENTFAULT_REFERER,
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
		if (typeMap[normalizedMime]) return typeMap[normalizedMime];

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
				const shouldRetry = this.isRetryableNetworkError(error);
				const hasNext = attempt < maxRetries;
				if (!shouldRetry || !hasNext) break;

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
				await randomDelay(400 * (attempt + 1), 900 * (attempt + 1));
			}
		}

		throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
	}

	private async resolveGatewayTokenFromWritePage(): Promise<string | null> {
		if (!this.cookieHeader) return null;
		try {
			const html = await this.request<string>(SEGMENTFAULT_WRITE_URL, {
				method: "GET",
				headers: {
					cookie: this.cookieHeader,
					accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				},
			});
			if (typeof html !== "string") return null;

			const tokenMatch = html.match(/serverData":\s*\{\s*"Token"\s*:\s*"([^"]+)"/);
			if (tokenMatch?.[1]) {
				return tokenMatch[1].trim();
			}

			const marker = "window.g_initialProps = ";
			const markerIndex = html.indexOf(marker);
			if (markerIndex !== -1) {
				const endIndex = html.indexOf(";</script>", markerIndex);
				if (endIndex !== -1) {
					const jsonStr = html.slice(markerIndex + marker.length, endIndex).trim();
					const payload = this.toRecord(this.tryParseJson(jsonStr));
					const global = this.toRecord(payload?.global);
					const sessionInfo = this.toRecord(global?.sessionInfo);
					const legacyToken = this.pickString(sessionInfo, "key");
					if (legacyToken) return legacyToken;
				}
			}
		} catch {
			// ignore
		}
		return null;
	}

	private async ensureGatewayToken(): Promise<string> {
		if (this.tokenCache) return this.tokenCache;

		const directToken = this.extractDirectToken(this.authToken);
		if (directToken) {
			this.tokenCache = directToken;
			return directToken;
		}

		const tokenFromWritePage = await this.resolveGatewayTokenFromWritePage();
		if (tokenFromWritePage) {
			this.tokenCache = tokenFromWritePage;
			return tokenFromWritePage;
		}

		throw new Error("Missing SegmentFault Token. Please provide a valid Token or a full login cookie.");
	}

	private buildGatewayUrl(path: string, query?: Record<string, string>): string {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(`${SEGMENTFAULT_GATEWAY_BASE_URL}${normalizedPath}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value) url.searchParams.set(key, value);
			}
		}
		return url.toString();
	}

	private async requestGateway<T>(
		path: string,
		method: "GET" | "POST" | "PUT",
		body?: unknown,
		query?: Record<string, string>,
	): Promise<T> {
		const token = await this.ensureGatewayToken();
		const headers: Record<string, string> = {
			token,
			accept: "*/*",
			cookie: this.cookieHeader,
			origin: SEGMENTFAULT_BASE_URL,
			referer: SEGMENTFAULT_REFERER,
		};

		let requestBody: BodyInit | undefined;
		if (body !== undefined && body !== null) {
			if (body instanceof FormData) {
				requestBody = body;
			} else {
				headers["Content-Type"] = "application/json";
				requestBody = JSON.stringify(body);
			}
		}

		return await this.request<T>(this.buildGatewayUrl(path, query), {
			method,
			headers,
			body: requestBody,
		});
	}

	private extractDraftId(payload: unknown): string | null {
		const unwrapped = this.unwrapGatewayPayload(payload);
		const record = this.toRecord(unwrapped);
		const direct = this.toStringId(record?.id);
		if (direct) return direct;
		const nestedData = this.toRecord(record?.data);
		return this.toStringId(nestedData?.id);
	}

	private extractPublishedArticleId(payload: unknown): string | null {
		const unwrapped = this.unwrapGatewayPayload(payload);
		const record = this.toRecord(unwrapped);
		const nestedData = this.toRecord(record?.data);
		return this.toStringId(nestedData?.id)
			?? this.toStringId(record?.id)
			?? null;
	}

	private extractUploadedImage(payload: unknown): SegmentFaultUploadedImage | null {
		const unwrapped = this.unwrapGatewayPayload(payload);
		const record = this.toRecord(unwrapped);
		if (record) {
			const resultUrl = this.pickString(record, "result")
				?? this.pickString(this.toRecord(record.data), "result")
				?? null;
			const coverUrlRaw = this.pickString(record, "url")
				?? this.pickString(this.toRecord(record.data), "url")
				?? null;

			const contentUrl = this.normalizeImageUrl(resultUrl ?? coverUrlRaw ?? "");
			if (contentUrl) {
				const coverUrl = this.resolveCoverUrlValue(coverUrlRaw, contentUrl);
				if (coverUrl) {
					return {
						contentUrl,
						coverUrl,
					};
				}
			}
		}

		if (Array.isArray(unwrapped) && unwrapped.length >= 3) {
			const fallback = this.toStringId(unwrapped[2]);
			if (fallback) {
				const contentUrl = `https://image-static.segmentfault.com/${fallback}`;
				return {
					contentUrl,
					coverUrl: contentUrl,
				};
			}
		}

		return null;
	}

	private resolveCoverUrlValue(rawCoverUrl: string | null, contentUrl: string): string | null {
		if (typeof rawCoverUrl === "string" && rawCoverUrl.trim()) {
			return rawCoverUrl.trim();
		}

		try {
			const parsed = new URL(contentUrl);
			if (parsed.pathname.startsWith("/img/")) {
				return parsed.pathname;
			}
		} catch {
			// ignore
		}

		return contentUrl || null;
	}

	private async uploadImageBySourceUrl(sourceUrl: string): Promise<SegmentFaultUploadedImage> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isSegmentFaultHostedImage(normalized)) {
			return {
				contentUrl: normalized,
				coverUrl: this.resolveCoverUrlValue(null, normalized) ?? normalized,
			};
		}

		await this.tracePublish({
			stage: "segmentfault_image_upload_start",
			message: "Start uploading SegmentFault image",
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

		const rawPayload = await this.withNetworkRetry(
			"segmentfault_image_upload_retry",
			async () => await this.requestGateway<unknown>(
				SEGMENTFAULT_GATEWAY_IMAGE_PATH,
				"POST",
				formData,
			),
			2,
		);
		const uploadedImage = this.extractUploadedImage(rawPayload);
		if (!uploadedImage) {
			throw new Error(`SegmentFault image upload returned invalid payload: ${JSON.stringify(rawPayload)}`);
		}

		await this.tracePublish({
			stage: "segmentfault_image_upload_done",
			message: "SegmentFault image uploaded",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
				contentUrl: uploadedImage.contentUrl,
				coverUrl: uploadedImage.coverUrl,
			},
		});

		return uploadedImage;
	}

	private getFixedTagIds(): number[] {
		return SEGMENTFAULT_DEFAULT_TAG_ID;
	}

	private async resolveCoverImage(article: SharedArticle): Promise<string | null> {
		const rawCover = article.coverImage?.trim();
		if (!rawCover) return null;

		const normalized = this.normalizeImageUrl(rawCover);
		if (!normalized) return null;
		if (!normalized.startsWith("data:") && this.isSegmentFaultHostedImage(normalized)) {
			return this.resolveCoverUrlValue(null, normalized) ?? normalized;
		}

		try {
			const uploaded = await this.uploadImageBySourceUrl(normalized);
			return uploaded.coverUrl;
		} catch (error) {
			await this.tracePublish({
				stage: "segmentfault_cover_upload_failed",
				level: "warn",
				message: "SegmentFault cover upload failed, skip cover",
				metadata: {
					source: normalized,
					error: error instanceof Error ? error.message : "unknown",
				},
			});
			return null;
		}
	}

	private async resolveArticleContent(article: SharedArticle): Promise<SegmentFaultResolvedContent> {
		const markdown = applyMarkdownContentSlots(article.content?.trim() ?? "", article);
		if (!markdown) {
			throw new Error("Article markdown content is empty, cannot publish to SegmentFault");
		}

		const imageSources = this.extractImageUrlsFromMarkdownContent(markdown);
		for (const source of imageSources) {
			const normalized = this.normalizeImageUrl(source);
			if (!normalized) continue;
			if (!normalized.startsWith("data:") && this.isSegmentFaultHostedImage(normalized)) continue;
			if (this.imageUrlCache.has(normalized)) continue;

			try {
				const uploaded = await this.uploadImageBySourceUrl(normalized);
				this.imageUrlCache.set(normalized, uploaded.contentUrl);
				await randomDelay(120, 280);
			} catch (error) {
				await this.tracePublish({
					stage: "segmentfault_resolve_single_image_failed",
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

		const coverUrl = await this.resolveCoverImage(article);

		return {
			markdownContent: replacedMarkdown,
			coverUrl,
		};
	}

	private buildDraftPayload(article: SharedArticle, content: SegmentFaultResolvedContent): Record<string, unknown> {
		return {
			title: article.title,
			tags: this.getFixedTagIds(),
			text: content.markdownContent,
			object_id: "",
			type: "article",
			language: "",
			cover: content.coverUrl ?? "",
		};
	}

	private buildPublishPayload(
		article: SharedArticle,
		content: SegmentFaultResolvedContent,
		draftId: string,
	): Record<string, unknown> {
		const parsedDraftId = this.toNumber(draftId) ?? draftId;
		return {
			tags: this.getFixedTagIds(),
			title: article.title,
			text: content.markdownContent,
			draft_id: parsedDraftId,
			blog_id: "1200000047718562",
			type: 1,
			url: "",
			cover: content.coverUrl ?? "",
			license: 1,
			log: "",
		};
	}

	private extractUserInfoFromSettingsHtml(html: string): AccountInfo | null {
		const profileMatch = html.match(/href="\/u\/([^"]+)"/i);
		if (!profileMatch?.[1]) return null;
		const userName = profileMatch[1].trim();
		if (!userName) return null;

		const avatarMatch = html.match(/src="(https:\/\/avatar-static\.segmentfault\.com\/[^"]+)"/i);
		const avatar = avatarMatch?.[1]?.trim() || undefined;

		return {
			id: userName,
			name: userName,
			avatar,
			isLogin: true,
		};
	}

	private async infoByGateway(): Promise<AccountInfo | null> {
		try {
			const payload = await this.requestGateway<unknown>(SEGMENTFAULT_GATEWAY_ME_PATH, "GET");
			const unwrapped = this.unwrapGatewayPayload(payload);
			const record = this.toRecord(unwrapped);
			const user = this.toRecord(record?.user) ?? record;
			if (!user) return null;

			const name = this.pickString(user, "name") ?? this.pickString(user, "username");
			if (!name) return null;
			const userId = this.toStringId(user.id) ?? name;
			const avatar = this.pickString(user, "avatar")
				?? this.pickString(user, "avatar_url")
				?? this.pickString(user, "avatarUrl")
				?? undefined;

			return {
				id: userId,
				name,
				avatar: avatar ? this.normalizeImageUrl(avatar) ?? avatar : undefined,
				isLogin: true,
			};
		} catch {
			return null;
		}
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "SegmentFault account verified successfully",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "SegmentFault account verification failed",
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
		const gatewayInfo = await this.infoByGateway();
		if (gatewayInfo) return gatewayInfo;

		if (this.cookieHeader) {
			const settingsHtml = await this.request<string>(SEGMENTFAULT_SETTINGS_URL, {
				method: "GET",
				headers: {
					cookie: this.cookieHeader,
					accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				},
			});
			if (typeof settingsHtml === "string") {
				const htmlInfo = this.extractUserInfoFromSettingsHtml(settingsHtml);
				if (htmlInfo) return htmlInfo;
			}
		}

		throw new Error("SegmentFault login session is invalid or Token is expired");
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "segmentfault_article_draft_start",
				message: "Start creating SegmentFault draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
				},
			});

			const content = await this.resolveArticleContent(article);
			const payload = this.buildDraftPayload(article, content);
			const data = await this.withNetworkRetry(
				"segmentfault_article_draft_retry",
				async () => await this.requestGateway<unknown>(
					SEGMENTFAULT_GATEWAY_DRAFT_PATH,
					"POST",
					payload,
				),
				2,
			);

			const draftId = this.extractDraftId(data);
			if (!draftId) {
				throw new Error(this.extractMessage(data));
			}

			this.draftContentCache.set(draftId, content);
			const draftUrl = `${SEGMENTFAULT_BASE_URL}/write?draftId=${encodeURIComponent(draftId)}`;

			await this.tracePublish({
				stage: "segmentfault_article_draft_done",
				message: "SegmentFault draft created",
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
				stage: "segmentfault_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "SegmentFault draft creation failed",
			});
			throw (error instanceof Error ? error : new Error(String(error)));
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		if (!draftId) {
			return {
				success: false,
				message: "Missing draftId for SegmentFault publish",
			};
		}
		try {
			await this.tracePublish({
				stage: "segmentfault_article_publish_start",
				message: "Start publishing SegmentFault article",
				metadata: {
					draftId: draftId || null,
				},
			});

			const content = this.draftContentCache.get(draftId) ?? await this.resolveArticleContent(article);

			const payload = this.buildPublishPayload(article, content, draftId);
			const data = await this.withNetworkRetry(
				"segmentfault_article_publish_retry",
				async () => await this.requestGateway<unknown>(
					SEGMENTFAULT_GATEWAY_ARTICLE_PATH,
					"POST",
					payload,
				),
				2,
			);

			const publishId = this.extractPublishedArticleId(data);
			if (!publishId) {
				throw new Error(this.extractMessage(data));
			}
			const publishedUrl = `${SEGMENTFAULT_BASE_URL}/a/${publishId}`;

			await this.tracePublish({
				stage: "segmentfault_article_publish_done",
				message: "SegmentFault article published",
				metadata: {
					draftId: draftId || null,
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
				stage: "segmentfault_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "SegmentFault publish failed",
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "SegmentFault publish failed",
			};
		} finally {
			if (draftId) {
				this.draftContentCache.delete(draftId);
			}
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: false, message: "SegmentFault API delete is not implemented in this integration." };
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
				const uploaded = await this.uploadImageBySourceUrl(normalized);
				return { success: true, url: uploaded.contentUrl, message: "Image uploaded successfully" };
			}

			const source = normalized?.startsWith("data:")
				? normalized
				: `data:image/jpeg;base64,${imageData.trim()}`;
			const uploaded = await this.uploadImageBySourceUrl(source);
			return { success: true, url: uploaded.contentUrl, message: "Image uploaded successfully" };
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Image upload failed",
			};
		}
	}
}

registerAccountService("segmentfault", SegmentFaultAccountService);
