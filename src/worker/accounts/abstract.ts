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
	PublishTraceEvent,
	PublishTraceLogger,
} from "@/worker/accounts/types";
import type { Article as SharedArticle } from "@/shared/types";

export abstract class AbstractAccountService implements AccountService {
	platform: PlatformType;
	protected authToken: string;
	protected headers: Record<string, string>;
	protected publishTraceLogger?: PublishTraceLogger;

	constructor(platform: PlatformType, authToken: string) {
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

	protected async tracePublish(event: PublishTraceEvent): Promise<void> {
		if (!this.publishTraceLogger) return;
		try {
			await this.publishTraceLogger(event);
		} catch {
			// Never break core publish logic because trace sink failed.
		}
	}

	private sanitizeUrlForLog(rawUrl: string): string {
		try {
			const parsed = new URL(rawUrl);
			const sensitiveKeys = new Set(["access_token", "token", "auth", "authorization", "cookie", "key", "secret"]);
			for (const [key] of parsed.searchParams.entries()) {
				if (sensitiveKeys.has(key.toLowerCase())) {
					parsed.searchParams.set(key, "***");
				}
			}
			return parsed.toString();
		} catch {
			return rawUrl;
		}
	}

	protected abstract buildHeaders(): Record<string, string>;

	protected async request<T>(
		url: string,
		options: RequestInit = {},
	): Promise<T> {
		const method = (options.method || "GET").toUpperCase();
		const safeUrl = this.sanitizeUrlForLog(url);

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
