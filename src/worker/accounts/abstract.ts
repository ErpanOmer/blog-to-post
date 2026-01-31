import type { PlatformType } from "../types";
import type {
	AccountService,
	AccountInfo,
	AccountStatus,
	ArticleDraft,
	Article,
	VerifyResult,
	ArticlePublishResult,
	ImageUploadResult,
} from "./types";

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
		const response = await fetch(url, {
			...options,
			headers: {
				...this.headers,
				...options.headers,
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	abstract verify(): Promise<VerifyResult>;
	abstract status(): Promise<AccountStatus>;
	abstract info(): Promise<AccountInfo>;
	abstract articleDraft(): Promise<ArticleDraft | null>;
	abstract articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult>;
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
