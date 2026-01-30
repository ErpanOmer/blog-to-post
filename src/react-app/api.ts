import type { Article, ArticleStatus, PlatformType, PromptKey, PromptTemplate, ProviderStatus } from "./types";

const jsonHeaders = {
	"Content-Type": "application/json",
};

async function parseJson<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!response.ok) {
		throw new Error(text || `HTTP ${response.status}`);
	}
	try {
		return JSON.parse(text) as T;
	} catch (error) {
		throw new Error(text || "Invalid JSON response");
	}
}

export async function getArticles(): Promise<Article[]> {
	return parseJson<Article[]>(await fetch("/api/articles"));
}

export async function getJuejinTopTitles(): Promise<string[]> {
	const data = await parseJson<{ titles: string[] }>(await fetch("/api/juejin/top"));
	return data.titles ?? [];
}

export async function generateTitle(input: { titleSource: "juejin" | "custom"; sourceTitles?: string[]; platform?: PlatformType }): Promise<{ title: string }> {
	return parseJson<{ title: string }>(
		await fetch("/api/articles/generate-title", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(input),
		}),
	);
}

export async function generateContent(title: string, onChunk?: (chunk: string) => void): Promise<{ content: string }> {
	const response = await fetch("/api/articles/generate-content", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title }),
	});
	
	if (!response.ok) throw new Error("Generate content failed");
	
	let fullContent = "";
	const reader = response.body?.getReader();
	const decoder = new TextDecoder();
	
	if (!reader) return { content: "" };
	
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			
			const chunk = decoder.decode(value);
			const lines = chunk.split("\n").filter(Boolean);
			
			for (const line of lines) {
				try {
					const json = JSON.parse(line);
					if (json.chunk) {
						fullContent += json.chunk;
						onChunk?.(json.chunk);
					}
					if (json.done) break;
				} catch {
					// 忽略解析错误
				}
			}
		}
	} finally {
		reader?.releaseLock();
	}
	
	return { content: fullContent };
}

export async function generateSummary(title: string, content: string): Promise<{ summary: string }> {
	return parseJson<{ summary: string }>(
		await fetch(`/api/articles/generate-summary`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ title, content }),
		}),
	);
}

export async function generateTags(title: string, content: string): Promise<{ tags: string[] }> {
	return parseJson<{ tags: string[] }>(
		await fetch(`/api/articles/generate-tags`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ title, content }),
		}),
	);
}

export async function generateCover(title: string, content: string): Promise<{ coverImage: string }> {
	return parseJson<{ coverImage: string }>(
		await fetch(`/api/articles/generate-cover`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ title, content }),
		}),
	);
}

export async function createArticle(payload: Article): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function updateArticle(id: string, payload: Partial<Article>): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles/${id}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}


export async function transitionArticle(id: string, status: ArticleStatus): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles/${id}/transition`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ status }),
		}),
	);
}

export async function distributeArticle(id: string, platforms: PlatformType[]): Promise<{ article: Article }> {
	return parseJson<{ article: Article }>(
		await fetch("/api/distribute", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ id, platforms }),
		}),
	);
}

export async function getProviderStatus(): Promise<ProviderStatus> {
	return parseJson<ProviderStatus>(await fetch("/api/ai/status"));
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
	return parseJson<PromptTemplate[]>(await fetch("/api/prompts"));
}

export async function updatePromptTemplate(key: PromptKey, template: string): Promise<PromptTemplate> {
	return parseJson<PromptTemplate>(
		await fetch(`/api/prompts/${key}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify({ template }),
		}),
	);
}




