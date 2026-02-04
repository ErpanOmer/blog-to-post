import type { PlatformType } from "@/worker/types";
import type {
	AccountService,
	AccountInfo,
	AccountStatus,
	ArticleDraft,
	Article,
	VerifyResult,
	ArticlePublishResult,
	ImageUploadResult,
} from "@/worker/accounts/types";
import type { Article as SharedArticle } from "@/shared/types";

export abstract class AbstractAccountService implements AccountService {
	platform: PlatformType;
	protected authToken: string;
	protected headers: Record<string, string>;

	constructor(platform: PlatformType, authToken: string) {
		this.platform = platform;
		this.authToken = authToken;
		this.headers = this.buildHeaders();
	}

	protected abstract buildHeaders(): Record<string, string>;

	protected async request<T>(
		url: string,
		options: RequestInit = {},
	): Promise<T> {
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
			let data: any;

			if (contentType && contentType.includes("application/json")) {
				try {
					data = await response.json();
				} catch {
					data = null; // Failed to parse JSON, empty body?
				}
			} else if (contentType && (contentType.includes("text/") || contentType.includes("xml"))) {
				data = await response.text();
			} else {
				// For other types (blob, etc), we might default to text or raw depending on T
				// Here we default to text primarily for API usage
				data = await response.text();
				// Try to parse as JSON if it looks like JSON even if header is wrong?
				// Optional: strict check. For robustness, let's keep it simple.
				try {
					if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
						data = JSON.parse(data);
					}
				} catch {
					// Ignore parse error, keep as string
				}
			}

			if (!response.ok) {
				const errorMessage = typeof data === 'object'
					? JSON.stringify(data)
					: (typeof data === 'string' ? data : response.statusText);

				throw new Error(`Request failed (${response.status}): ${errorMessage}`);
			}

			return data as T;
		} catch (error: any) {
			// Re-throw with clear message if it's not already handled
			if (error.name === 'AbortError') {
				throw new Error(`Request timeout after 30s: ${url}`);
			}
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

export interface XiaohongshuUserInfo {
	user_id: string;
	nickname: string;
	avatar: string;
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
