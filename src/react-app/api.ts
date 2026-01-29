import type { Article, ArticleStatus, PlatformType, PromptTemplate, ProviderStatus } from "./types";

const jsonHeaders = {
	"Content-Type": "application/json",
};

export async function getArticles(): Promise<Article[]> {
	const response = await fetch("/api/articles");
	return (await response.json()) as Article[];
}

export async function generateArticle(input: {
	title: string;
	outline?: string;
	platform: PlatformType;
	tone: "technical" | "casual" | "marketing";
	length: "short" | "medium" | "long";
}): Promise<Article> {
	const response = await fetch("/api/articles/generate", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify(input),
	});
	return (await response.json()) as Article;
}

export async function updateArticle(id: string, payload: Partial<Article>): Promise<Article> {
	const response = await fetch(`/api/articles/${id}`, {
		method: "PUT",
		headers: jsonHeaders,
		body: JSON.stringify(payload),
	});
	return (await response.json()) as Article;
}

export async function transitionArticle(id: string, status: ArticleStatus): Promise<Article> {
	const response = await fetch(`/api/articles/${id}/transition`, {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify({ status }),
	});
	return (await response.json()) as Article;
}

export async function distributeArticle(id: string, platforms: PlatformType[]): Promise<{ article: Article }> {
	const response = await fetch("/api/distribute", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify({ id, platforms }),
	});
	return (await response.json()) as { article: Article };
}

export async function getProviderStatus(): Promise<ProviderStatus> {
	const response = await fetch("/api/ai/status");
	return (await response.json()) as ProviderStatus;
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
	const response = await fetch("/api/prompts");
	return (await response.json()) as PromptTemplate[];
}

export async function updatePromptTemplate(key: PlatformType, template: string): Promise<PromptTemplate> {
	const response = await fetch(`/api/prompts/${key}`, {
		method: "PUT",
		headers: jsonHeaders,
		body: JSON.stringify({ template }),
	});
	return (await response.json()) as PromptTemplate;
}
