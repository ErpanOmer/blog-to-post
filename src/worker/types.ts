export type PlatformType = "juejin" | "zhihu" | "xiaohongshu" | "wechat" | "csdn" | "";
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

export interface PlatformAccount {
	id: string;
	platform: PlatformType;
	authToken?: string | null;
	description?: string | null;
	isActive: boolean;
	isVerified: boolean;
	lastVerifiedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface VerifyAccountResult {
	valid: boolean;
	message: string;
	accountInfo?: {
		id: string;
		name: string;
		isLogin: boolean;
	};
}

export interface Task {
	id: string;
	type: "generate" | "publish";
	status: "pending" | "success" | "failed";
	payload: Record<string, unknown>;
}

export interface GenerateContentInput {
	title: string;
}

export interface GenerateSummaryInput {
	title: string;
	content: string;
}

export interface GenerateTagsInput {
	title: string;
	content: string;
}

export interface GenerateCoverInput {
	title: string;
	content: string;
}

export interface AIProvider {
	generateTitleText(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
	generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
	generateSummary(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
	generateImage(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
}

export interface Env {
	DB: D1Database;
	PROMPTS: KVNamespace;
	DRAFTS: R2Bucket;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
	OLLAMA_API_KEY?: string;
	ENVIRONMENT?: "production" | "development" | undefined;
}







