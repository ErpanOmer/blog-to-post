import type { Ai } from "@cloudflare/ai";

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

export interface GenerateInput {
	title: string;
	outline?: string;
	platform: PlatformType;
	tone: "technical" | "casual" | "marketing";
	length: "short" | "medium" | "long";
}

export interface AIProvider {
	generateArticle(input: GenerateInput): Promise<string>;
}

export interface Env {
	DB: D1Database;
	PROMPTS: KVNamespace;
	DRAFTS: R2Bucket;
	AI: Ai;
	AI_PROVIDER: string;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
}
