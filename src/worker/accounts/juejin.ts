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
import { randomDelay } from "@/worker/utils/helpers";
import { applyMarkdownContentSlots } from "@/worker/utils/content-slots";
import { crc32, signAWS4 } from "@/worker/utils/aws4";
import { resolveImageMimeTypeFromBlob } from "@/worker/utils/media";
import { convertHtmlImagesToMarkdown, normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";

const JUEJIN_BASE_URL = "https://juejin.cn";
const JUEJIN_API_BASE_URL = "https://api.juejin.cn";
const JUEJIN_DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const IMAGEX_AID = "2608";
const IMAGEX_SERVICE_ID = "73owjymdk6";

interface JuejinApiResponse<T> {
	err_no?: number;
	err_msg?: string;
	data?: T;
}

interface JuejinUserPayload {
	user_id?: string;
	user_name?: string;
	avatar?: string;
	avatar_large?: string;
	is_realname?: number;
}

interface JuejinDraftCreatePayload {
	id?: string;
	draft_id?: string;
	article_id?: string;
	title?: string;
}

interface JuejinPublishPayload {
	article_id?: string;
	id?: string;
}

interface JuejinImageXTokenPayload {
	token?: {
		AccessKeyId?: string;
		SecretAccessKey?: string;
		SessionToken?: string;
		ExpiredTime?: string;
		CurrentTime?: string;
	};
}

interface JuejinImageXToken {
	AccessKeyId: string;
	SecretAccessKey: string;
	SessionToken?: string;
	ExpiredTime: number;
}

interface ImageXUploadAddress {
	StoreInfos: Array<{
		StoreUri: string;
		Auth: string;
		UploadID?: string;
	}>;
	UploadHosts: string[];
	SessionKey: string;
}

interface ImageXApplyUploadResponse {
	ResponseMetadata?: {
		RequestId?: string;
		Error?: {
			Code?: string;
			Message?: string;
		};
	};
	Result?: {
		UploadAddress?: ImageXUploadAddress;
	};
}

interface ImageXCommitUploadResponse {
	ResponseMetadata?: {
		RequestId?: string;
		Error?: {
			Code?: string;
			Message?: string;
		};
	};
	Result?: {
		Results?: Array<{
			Uri?: string;
			UriStatus?: number;
		}>;
	};
}

function generateUUID(): string {
	return "xxxxxxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)) + Date.now().toString();
}

export default class JuejinAccountService extends AbstractAccountService {
	private cachedCsrfToken: string | null = null;
	private cachedImageXToken: JuejinImageXToken | null = null;
	private imageXTokenExpiry = 0;
	private imageUrlCache = new Map<string, string>();
	private draftMetaCache = new Map<string, { articleId?: string; markdownContent: string }>();
	private readonly uuid = generateUUID();
	private readonly cookieHeader: string;

	constructor(authToken: string) {
		super("juejin", authToken);
		this.cookieHeader = this.normalizeCookieHeader(authToken);
		this.headers = this.buildHeaders();
	}

	protected buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			accept: "application/json, text/plain, */*",
			origin: JUEJIN_BASE_URL,
			referer: `${JUEJIN_BASE_URL}/`,
			"user-agent": JUEJIN_DEFAULT_USER_AGENT,
		};

		const cookie = this.cookieHeader || this.normalizeCookieHeader(this.authToken);
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

	private normalizeImageUrl(rawUrl: string): string | null {
		const trimmed = rawUrl.trim();
		if (!trimmed) return null;
		if (trimmed.startsWith("data:")) return trimmed;

		const withProtocol = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
		try {
			const parsed = new URL(withProtocol);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
			return parsed.toString();
		} catch {
			return null;
		}
	}

	private isJuejinHostedImage(imageUrl: string): boolean {
		try {
			const host = new URL(imageUrl).hostname.toLowerCase();
			return host.includes("juejin.cn")
				|| host.includes("byteimg.com")
				|| host.includes("p1-juejin")
				|| host.includes("p3-juejin")
				|| host.includes("p6-juejin")
				|| host.includes("p9-juejin");
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

	private async downloadImageFromUrl(imageUrl: string): Promise<Blob> {
		const response = await fetch(imageUrl, {
			method: "GET",
			headers: {
				accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
				"user-agent": JUEJIN_DEFAULT_USER_AGENT,
			},
		});

		if (!response.ok) {
			throw new Error(`Image download failed (${response.status}): ${imageUrl}`);
		}

		const blob = await response.blob();
		const mimeType = await resolveImageMimeTypeFromBlob(blob);
		if (blob.type === mimeType) return blob;

		return new Blob([await blob.arrayBuffer()], { type: mimeType });
	}

	private async getImageBlob(source: string): Promise<Blob> {
		if (source.startsWith("data:")) {
			const blob = this.dataUriToBlob(source);
			const mimeType = await resolveImageMimeTypeFromBlob(blob);
			if (blob.type === mimeType) return blob;
			return new Blob([await blob.arrayBuffer()], { type: mimeType });
		}
		return await this.downloadImageFromUrl(source);
	}

	private async requestJuejinApi<T>(
		path: string,
		options: RequestInit = {},
	): Promise<JuejinApiResponse<T>> {
		const url = path.startsWith("http") ? path : `${JUEJIN_API_BASE_URL}${path}`;
		const data = await this.request<JuejinApiResponse<T>>(url, {
			...options,
			headers: {
				...(options.body ? { "Content-Type": "application/json" } : {}),
				...options.headers,
			},
		});

		if (typeof data.err_no === "number" && data.err_no !== 0) {
			throw new Error(`Juejin API failed [${path}]: ${data.err_msg || `err_no=${data.err_no}`}`);
		}

		return data;
	}

	private async fetchJson<T>(url: string, options: RequestInit, message: string): Promise<T> {
		const response = await fetch(url, options);
		const rawText = await response.text();
		if (!response.ok) {
			throw new Error(`${message}: ${response.status} ${rawText.slice(0, 300)}`);
		}

		try {
			return JSON.parse(rawText) as T;
		} catch {
			throw new Error(`${message}: invalid JSON response ${rawText.slice(0, 120)}`);
		}
	}

	private async getCsrfToken(): Promise<string> {
		if (this.cachedCsrfToken) {
			return this.cachedCsrfToken;
		}

		const response = await fetch(`${JUEJIN_API_BASE_URL}/user_api/v1/sys/token`, {
			method: "HEAD",
			headers: {
				...this.headers,
				"x-secsdk-csrf-request": "1",
				"x-secsdk-csrf-version": "1.2.10",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to get Juejin CSRF token: ${response.status}`);
		}

		const wareToken = response.headers.get("x-ware-csrf-token");
		if (!wareToken) {
			throw new Error("Failed to get Juejin CSRF token: response header is empty");
		}

		const parts = wareToken.split(",");
		if (parts.length < 2 || !parts[1]) {
			throw new Error("Failed to get Juejin CSRF token: invalid token format");
		}

		this.cachedCsrfToken = parts[1];
		return this.cachedCsrfToken;
	}

	private async getImageXToken(): Promise<JuejinImageXToken> {
		if (this.cachedImageXToken && Date.now() < this.imageXTokenExpiry - 60000) {
			return this.cachedImageXToken;
		}

		const response = await this.requestJuejinApi<JuejinImageXTokenPayload>(
			`/imagex/v2/gen_token?aid=${IMAGEX_AID}&uuid=${encodeURIComponent(this.uuid)}&client=web`,
		);

		const token = response.data?.token;
		if (!token?.AccessKeyId || !token.SecretAccessKey) {
			throw new Error("Juejin ImageX token response is invalid");
		}

		const expiredAt = token.ExpiredTime ? new Date(token.ExpiredTime).getTime() : Date.now() + 10 * 60 * 1000;
		this.cachedImageXToken = {
			AccessKeyId: token.AccessKeyId,
			SecretAccessKey: token.SecretAccessKey,
			SessionToken: token.SessionToken,
			ExpiredTime: expiredAt,
		};
		this.imageXTokenExpiry = expiredAt;

		return this.cachedImageXToken;
	}

	private async applyImageUpload(token: JuejinImageXToken): Promise<ImageXUploadAddress> {
		const url = `https://imagex.bytedanceapi.com/?Action=ApplyImageUpload&Version=2018-08-01&ServiceId=${IMAGEX_SERVICE_ID}`;
		const signed = await signAWS4({
			method: "GET",
			url,
			accessKeyId: token.AccessKeyId,
			secretAccessKey: token.SecretAccessKey,
			securityToken: token.SessionToken,
			region: "cn-north-1",
			service: "imagex",
		});

		const data = await this.fetchJson<ImageXApplyUploadResponse>(
			url,
			{
				method: "GET",
				headers: {
					...signed.headers,
					origin: JUEJIN_BASE_URL,
					referer: `${JUEJIN_BASE_URL}/`,
				},
			},
			"Juejin ImageX apply upload failed",
		);

		if (data.ResponseMetadata?.Error) {
			throw new Error(data.ResponseMetadata.Error.Message || data.ResponseMetadata.Error.Code || "Juejin ImageX apply upload failed");
		}

		const uploadAddress = data.Result?.UploadAddress;
		if (!uploadAddress?.StoreInfos?.[0] || !uploadAddress.UploadHosts?.[0] || !uploadAddress.SessionKey) {
			throw new Error("Juejin ImageX apply upload returned invalid upload address");
		}

		return uploadAddress;
	}

	private async uploadToTOS(uploadAddress: ImageXUploadAddress, file: Blob): Promise<void> {
		const storeInfo = uploadAddress.StoreInfos[0];
		const uploadHost = uploadAddress.UploadHosts[0];
		if (!storeInfo || !uploadHost) {
			throw new Error("Juejin ImageX upload address is invalid");
		}

		const arrayBuffer = await file.arrayBuffer();
		const bytes = new Uint8Array(arrayBuffer);
		const uploadUrl = `https://${uploadHost}/${storeInfo.StoreUri}`;
		const response = await fetch(uploadUrl, {
			method: "PUT",
			headers: {
				authorization: storeInfo.Auth,
				"Content-Type": file.type || "application/octet-stream",
				"Content-CRC32": crc32(bytes),
			},
			body: file,
		});

		if (!response.ok) {
			throw new Error(`Juejin TOS image upload failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
		}
	}

	private async commitImageUpload(token: JuejinImageXToken, sessionKey: string): Promise<void> {
		const url =
			`https://imagex.bytedanceapi.com/?Action=CommitImageUpload&Version=2018-08-01&SessionKey=${encodeURIComponent(sessionKey)}&ServiceId=${IMAGEX_SERVICE_ID}`;
		const signed = await signAWS4({
			method: "POST",
			url,
			accessKeyId: token.AccessKeyId,
			secretAccessKey: token.SecretAccessKey,
			securityToken: token.SessionToken,
			region: "cn-north-1",
			service: "imagex",
		});

		const data = await this.fetchJson<ImageXCommitUploadResponse>(
			url,
			{
				method: "POST",
				headers: {
					...signed.headers,
					"Content-Length": "0",
					origin: JUEJIN_BASE_URL,
					referer: `${JUEJIN_BASE_URL}/`,
				},
			},
			"Juejin ImageX commit upload failed",
		);

		if (data.ResponseMetadata?.Error) {
			throw new Error(data.ResponseMetadata.Error.Message || data.ResponseMetadata.Error.Code || "Juejin ImageX commit upload failed");
		}
	}

	private async getImageUrl(uri: string): Promise<string> {
		const response = await this.requestJuejinApi<{ main_url?: string; backup_url?: string }>(
			`/imagex/v2/get_img_url?aid=${IMAGEX_AID}&uuid=${encodeURIComponent(this.uuid)}&uri=${encodeURIComponent(uri)}&img_type=private`,
		);
		const imageUrl = response.data?.main_url || response.data?.backup_url;
		if (!imageUrl) {
			throw new Error("Juejin ImageX get image URL response is invalid");
		}
		return imageUrl;
	}

	private async uploadImageBlob(file: Blob): Promise<string> {
		const token = await this.getImageXToken();
		const uploadAddress = await this.applyImageUpload(token);
		await this.uploadToTOS(uploadAddress, file);
		await this.commitImageUpload(token, uploadAddress.SessionKey);

		const storeUri = uploadAddress.StoreInfos[0]?.StoreUri;
		if (!storeUri) {
			throw new Error("Juejin ImageX upload result is missing store URI");
		}

		return await this.getImageUrl(storeUri);
	}

	private async uploadImageBySourceUrl(source: string): Promise<string> {
		const normalized = this.normalizeImageUrl(source);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${source}`);
		}

		if (!normalized.startsWith("data:") && this.isJuejinHostedImage(normalized)) {
			return normalized;
		}

		if (this.imageUrlCache.has(normalized)) {
			return this.imageUrlCache.get(normalized)!;
		}

		const blob = await this.getImageBlob(normalized);
		const uploadedUrl = await this.uploadImageBlob(blob);
		this.imageUrlCache.set(normalized, uploadedUrl);
		return uploadedUrl;
	}

	private replaceJuejinMarkdownImageUrls(markdownContent: string): string {
		if (!markdownContent) return markdownContent;

		const options = {
			normalizeUrl: (rawUrl: string) => this.normalizeImageUrl(rawUrl),
			resolveUrl: (normalizedUrl: string) => this.imageUrlCache.get(normalizedUrl),
		};
		const markdownImagesOnly = convertHtmlImagesToMarkdown(markdownContent, options);
		return normalizeMarkdownImageSyntax(markdownImagesOnly, options);
	}

	private async resolveCoverImage(article: SharedArticle): Promise<string> {
		const normalized = this.normalizeImageUrl(article.coverImage?.trim() ?? "");
		if (!normalized) return "";

		if (!normalized.startsWith("data:") && this.isJuejinHostedImage(normalized)) {
			return normalized;
		}

		try {
			const uploaded = await this.uploadImageBySourceUrl(normalized);
			await this.tracePublish({
				stage: "juejin_cover_upload_done",
				message: "Juejin cover image uploaded",
				metadata: {
					source: normalized,
					uploadedUrl: uploaded,
				},
			});
			return uploaded;
		} catch (error) {
			await this.tracePublish({
				stage: "juejin_cover_upload_failed",
				level: "warn",
				message: "Juejin cover image upload failed, continue without cover",
				metadata: {
					source: normalized,
					error: error instanceof Error ? error.message : "unknown",
				},
			});
			return "";
		}
	}

	private async resolveArticleMarkdown(article: SharedArticle): Promise<string> {
		let markdown = applyMarkdownContentSlots(article.content?.trim() ?? "", article);
		if (!markdown) {
			throw new Error("Article markdown content is empty, cannot publish to Juejin");
		}

		const imageSources = this.extractImageUrlsFromMarkdownContent(markdown);
		await this.tracePublish({
			stage: "juejin_content_images_scan",
			message: "Scan content images for Juejin ImageX",
			metadata: {
				totalImages: imageSources.length,
				hasCoverImage: Boolean(article.coverImage?.trim()),
			},
		});

		for (const source of imageSources) {
			const normalized = this.normalizeImageUrl(source);
			if (!normalized) continue;
			if (!normalized.startsWith("data:") && this.isJuejinHostedImage(normalized)) continue;
			if (this.imageUrlCache.has(normalized)) continue;

			try {
				const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
				this.imageUrlCache.set(normalized, uploadedUrl);
				await randomDelay(120, 280);
			} catch (error) {
				await this.tracePublish({
					stage: "juejin_resolve_single_image_failed",
					level: "warn",
					message: "Image upload failed, keep original source",
					metadata: {
						source: normalized,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
			}
		}

		markdown = this.replaceJuejinMarkdownImageUrls(markdown);

		await this.tracePublish({
			stage: "juejin_resolve_content_done",
			message: "Juejin article markdown resolved",
			metadata: {
				markdownLength: markdown.length,
				replacedImages: this.imageUrlCache.size,
				imageDestinationSyntax: "plain-no-title",
			},
		});

		return markdown;
	}

	private extractFirstString(value: unknown, keys: string[]): string | undefined {
		if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
		const record = value as Record<string, unknown>;
		for (const key of keys) {
			const candidate = record[key];
			if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
			if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
		}
		return undefined;
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "掘金账号验证成功",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "掘金账号验证失败",
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
		const response = await this.requestJuejinApi<JuejinUserPayload>("/user_api/v1/user/get");
		const user = response.data;
		if (!user?.user_id) {
			throw new Error("掘金登录态无效或 Cookie 已过期");
		}

		return {
			id: user.user_id,
			name: user.user_name || user.user_id,
			avatar: user.avatar_large || user.avatar,
			isLogin: true,
			isRealname: user.is_realname === 1,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "juejin_article_draft_start",
				message: "Start creating Juejin draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
					hasCoverImage: Boolean(article.coverImage?.trim()),
				},
			});

			const csrfToken = await this.getCsrfToken();
			const markdown = await this.resolveArticleMarkdown(article);
			const coverImage = await this.resolveCoverImage(article);
			const response = await this.requestJuejinApi<JuejinDraftCreatePayload>(
				"/content_api/v1/article_draft/create",
				{
					method: "POST",
					headers: {
						"x-secsdk-csrf-token": csrfToken,
					},
					body: JSON.stringify({
						brief_content: article.summary,
						category_id: "6809637767543259144",
						cover_image: coverImage,
						edit_type: 10,
						html_content: "deprecated",
						link_url: "",
						mark_content: markdown,
						tag_ids: [
							"6809640407484334093",
							"6809640398105870343",
							"6809640482725953550"
						],
						theme_ids: [
							"7275231252674773028"
						],
						title: article.title,
					}),
				},
			);

			const draftId = this.extractFirstString(response.data, ["id", "draft_id"]);
			if (!draftId) {
				throw new Error("Juejin draft creation returned invalid draft id");
			}

			const articleId = this.extractFirstString(response.data, ["article_id"]);
			this.draftMetaCache.set(draftId, {
				articleId,
				markdownContent: markdown,
			});

			const draftUrl = `${JUEJIN_BASE_URL}/editor/drafts/${draftId}`;
			await this.tracePublish({
				stage: "juejin_article_draft_done",
				message: "Juejin draft created",
				metadata: {
					draftId,
					articleId: articleId ?? null,
					draftUrl,
					hasCoverImage: Boolean(coverImage),
				},
			});

			return {
				id: draftId,
				title: article.title,
				content: markdown,
				createdAt: Date.now(),
				url: draftUrl,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "juejin_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Juejin draft creation failed",
			});
			return null;
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		if (!draftId) {
			return {
				success: false,
				message: "掘金发布必须先创建草稿并提供 draftId",
			};
		}

		try {
			await this.tracePublish({
				stage: "juejin_article_publish_start",
				message: "Start publishing Juejin article",
				metadata: {
					draftId,
				},
			});

			const csrfToken = await this.getCsrfToken();
			const cached = this.draftMetaCache.get(draftId);
			const payload: Record<string, unknown> = {
				draft_id: draftId,
				sync_to_org: false,
				column_ids: [],
			};
			if (cached?.articleId) {
				payload.article_id = cached.articleId;
			}

			const response = await this.requestJuejinApi<JuejinPublishPayload>(
				"/content_api/v1/article/publish",
				{
					method: "POST",
					headers: {
						"x-secsdk-csrf-token": csrfToken,
					},
					body: JSON.stringify(payload),
				},
			);

			const articleId = this.extractFirstString(response.data, ["article_id", "id"])
				|| cached?.articleId
				|| draftId;
			const url = `${JUEJIN_BASE_URL}/post/${articleId}`;

			await this.tracePublish({
				stage: "juejin_article_publish_done",
				message: "Juejin article published",
				metadata: {
					draftId,
					articleId,
					url,
				},
			});

			return {
				success: true,
				articleId,
				message: "掘金文章发布成功",
				url,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "juejin_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Juejin article publish failed",
				metadata: {
					draftId,
				},
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "掘金文章发布失败",
			};
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		try {
			const csrfToken = await this.getCsrfToken();
			try {
				await this.requestJuejinApi("/content_api/v1/article/delete", {
					method: "POST",
					headers: {
						"x-secsdk-csrf-token": csrfToken,
					},
					body: JSON.stringify({ article_id: articleId }),
				});
			} catch {
				await this.requestJuejinApi("/content_api/v1/article_draft/delete", {
					method: "POST",
					headers: {
						"x-secsdk-csrf-token": csrfToken,
					},
					body: JSON.stringify({ id: articleId }),
				});
			}

			return { success: true, message: "掘金文章删除成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "掘金文章删除失败" };
		}
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		try {
			const account = await this.info();
			const response = await this.requestJuejinApi<{
				articles?: Array<{
					article_id?: string;
					title?: string;
					brief_content?: string;
					ctime?: string | number;
					status?: number;
				}>;
			}>(
				"/content_api/v1/article/list_by_user",
				{
					method: "POST",
					body: JSON.stringify({
						user_id: account.id,
						sort_type: 2,
						cursor: String(Math.max(0, page - 1) * pageSize),
						limit: pageSize,
					}),
				},
			);

			return (response.data?.articles ?? []).map((item) => ({
				id: item.article_id || "",
				title: item.title || "",
				content: item.brief_content || "",
				publishedAt: typeof item.ctime === "number"
					? item.ctime
					: Number.parseInt(item.ctime || "0", 10) || undefined,
				status: item.status === 1 ? "draft" as const : "published" as const,
			})).filter((item) => Boolean(item.id));
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const response = await this.requestJuejinApi<{
				article_id?: string;
				title?: string;
				mark_content?: string;
				brief_content?: string;
				ctime?: string | number;
				status?: number;
			}>(
				"/content_api/v1/article/detail",
				{
					method: "POST",
					body: JSON.stringify({ article_id: articleId }),
				},
			);

			if (!response.data?.article_id) return null;

			return {
				id: response.data.article_id,
				title: response.data.title || "",
				content: response.data.mark_content || response.data.brief_content || "",
				publishedAt: typeof response.data.ctime === "number"
					? response.data.ctime
					: Number.parseInt(response.data.ctime || "0", 10) || undefined,
				status: response.data.status === 1 ? "draft" : "published",
			};
		} catch {
			return null;
		}
	}

	async articleTags(articleId: string): Promise<string[]> {
		void articleId;
		return [];
	}

	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		void filename;
		try {
			const normalized = this.normalizeImageUrl(imageData);
			const blob = normalized
				? await this.getImageBlob(normalized)
				: new Blob([Uint8Array.from(atob(imageData), (char) => char.charCodeAt(0))], {
					type: "application/octet-stream",
				});
			const url = await this.uploadImageBlob(blob);
			return { success: true, url, message: "掘金图片上传成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "掘金图片上传失败" };
		}
	}
}

registerAccountService("juejin", JuejinAccountService);
