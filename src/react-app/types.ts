export type PlatformType = "juejin" | "zhihu" | "xiaohongshu" | "wechat" | "";
export type ArticleStatus = "draft" | "reviewed" | "scheduled" | "published" | "failed";
export type PromptKey = "title" | "content" | "summary" | "tags" | "cover";

export interface Article {
	id: string;
	title: string;
	content: string;
	summary?: string | null;
	tags?: string[] | null;
	coverImage?: string | null;
	platform: PlatformType;
	status: ArticleStatus;
	publishedAt?: number | null;
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
	key: PromptKey;
	template: string;
}



