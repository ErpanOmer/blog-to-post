export type PlatformType = "juejin" | "zhihu" | "xiaohongshu" | "wechat";
export type ArticleStatus = "draft" | "reviewed" | "scheduled" | "published" | "failed";

export interface Article {
	id: string;
	title: string;
	content: string;
	platform: PlatformType;
	status: ArticleStatus;
	createdAt: number;
	updatedAt: number;
}

export interface Task {
	id: string;
	type: "generate" | "publish";
	status: "pending" | "success" | "failed";
	payload: Record<string, unknown>;
}

export interface ProviderStatus {
	provider: string;
	ready: boolean;
	lastCheckedAt: number;
	message: string;
}

export interface PromptTemplate {
	key: PlatformType;
	template: string;
}
