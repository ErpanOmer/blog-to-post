export * from "@/shared/types";

// Backend-specific types
export interface AIGenerationOverrides {
	model?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	requestTimeoutSec?: number;
	numCtx?: number;
	think?: string | boolean;
	format?: string;
	extraOptions?: Record<string, unknown>;
}

export interface AIProvider {
	generateTitleText(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
	generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
	generateSummary(
		systemPrompt: string,
		userPrompt: string,
		overrides?: AIGenerationOverrides,
	): Promise<string>;
	generateTags(
		systemPrompt: string,
		userPrompt: string,
		overrides?: AIGenerationOverrides,
	): Promise<string>;
	generateImage(systemPrompt: string, userPrompt: string, model?: string): Promise<string>;
}

export interface Env {
	DB: D1Database;
	PROMPTS: KVNamespace;
	DRAFTS: R2Bucket;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
	OLLAMA_API_KEY?: string;
	ENCRYPTION_KEY?: string;
	ENVIRONMENT?: "production" | "development" | undefined;
}
