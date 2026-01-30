import { Hono } from "hono";
import type { Env, GenerateCoverInput, GenerateSummaryInput, GenerateTagsInput, GenerateTitleInput, PlatformType, PromptKey } from "./types";
import { createAIProvider } from "./ai/providers";
import { getPlatformAdapter } from "./platform/adapters";
import { listArticles, getArticle, createArticle, updateArticle } from "./db/articles";
import { createTask } from "./db/tasks";
import { listPromptTemplates, setPromptTemplate } from "./services/prompts";
import { saveDraft, savePublished } from "./services/storage";
import { canTransition, transitionArticle } from "./services/distribution";
import { runDailyCron } from "./cron";
import titleSystemPrompt from "./prompts/generate-title-system-prompt.txt?raw";
import titleUserPromptTpl from "./prompts/generate-title-user-prompt.txt?raw";
import generateContentSystemPrompt from "./prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "./prompts/generate-content-user-prompt.txt?raw";
import summaryPrompt from "./prompts/summary.prompt.txt?raw";
import tagsPrompt from "./prompts/tags.prompt.txt?raw";
import coverPrompt from "./prompts/cover.prompt.txt?raw";

const app = new Hono<{ Bindings: Env }>();
const JUEJIN_TOP_URL = "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=6809637767543259144&type=hot&aid=2608&uuid=7581427136196675078&spider=0";

const fallbackCover = "/vite.svg";

function pickFirstLine(text: string) {
	const line = text.split("\n").find((item) => item.trim());
	return line?.trim() ?? "";
}

function normalizeTags(text: string) {
	return text
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 6);
}

async function fetchJuejinTopTitles() {
	try {
		const response = await fetch(JUEJIN_TOP_URL, {
			method: "GET",
			headers: { "Content-Type": "application/json" }
		});
		if (!response.ok) {
			return [] as string[];
		}
		const data = (await response.json()) as {
			data?: Array<{ content?: { title?: string }; title?: string }>;
		};
		return (data.data ?? [])
			.map((item) => item.content?.title ?? item.title)
			.filter((title): title is string => Boolean(title))
			.slice(0, 20);
	} catch (error) {
		console.error("掘金标题抓取失败", error);
		return [] as string[];
	}
}


app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: Date.now() }),
);

app.get("/api/articles", async (c) => {
	const articles = await listArticles(c.env.DB);
	return c.json(articles);
});

app.get("/api/juejin/top", async (c) => {
	const titles = await fetchJuejinTopTitles();
	return c.json({ titles });
});

app.post("/api/articles/generate-title", async (c) => {
	const input = (await c.req.json()) as GenerateTitleInput;
	const provider = createAIProvider(c.env);
	const sourceTitles = input.sourceTitles?.length
		? input.sourceTitles
		: input.titleSource === "juejin"
			? await fetchJuejinTopTitles()
			: [];

	const userPrompt = titleUserPromptTpl.replace("{{JUEJIN_TOP_20_TITLES}}", (sourceTitles ?? []).join("\n") || "无数据");
	const titleRaw = await provider.generateTitleText(titleSystemPrompt, userPrompt);
	const title = pickFirstLine(titleRaw);
	return c.json({ title });
});

app.post("/api/articles/generate-content", async (c) => {
	const { title } = (await c.req.json()) as { title: string };
	
	if (!title || !title.trim()) {
		return c.json({ error: "Title is required" }, 400);
	}
	
	console.log("[generate-content] 开始生成内容，标题:", title);
	
	const provider = createAIProvider(c.env);
	const userPrompt = generateContentUserPrompt.replace("{{TITLE}}", title);
	const systemPrompt = generateContentSystemPrompt.replace("{{TITLE}}", title);
	
	console.log("[generate-content] 准备调用 AI Provider");
	
	return new Response(
		new ReadableStream({
			async start(controller) {
				let totalChunks = 0;
				let totalContent = "";
				let buffer = "";
				
				try {
					console.log("[generate-content] 开始流式生成");
					const stream = await (provider as any).callModelStream(systemPrompt, userPrompt, "deepseek-v3.1:671b-cloud");
					
					if (!stream) {
						console.error("[generate-content] AI Provider 返回 null");
						controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: "Failed to get stream from AI provider" }) + "\n"));
						controller.close();
						return;
					}

					const reader = stream.getReader();
					const decoder = new TextDecoder();

					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) {
								console.log("[generate-content] 流式生成完成，总块数:", totalChunks, "总字符数:", totalContent.length);
								break;
							}

							const chunk = decoder.decode(value, { stream: true });
							buffer += chunk;
							
							const lines = buffer.split("\n");
							buffer = lines.pop() || "";

							for (const line of lines) {
								if (!line.trim()) continue;
								
								try {
									const json = JSON.parse(line);
									if (json.response) {
										totalChunks++;
										totalContent += json.response;
										controller.enqueue(new TextEncoder().encode(JSON.stringify({ chunk: json.response }) + "\n"));
									}
								} catch (parseError) {
									console.warn("[generate-content] JSON 解析失败:", line.substring(0, 100), parseError);
								}
							}
						}
					} finally {
						reader.releaseLock();
					}

					controller.enqueue(new TextEncoder().encode(JSON.stringify({ done: true }) + "\n"));
					console.log("[generate-content] 响应发送完成");
				} catch (err) {
					console.error("[generate-content] 生成过程中发生错误:", err);
					controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: `Generation failed: ${err instanceof Error ? err.message : String(err)}` }) + "\n"));
				} finally {
					controller.close();
				}
			}
		}),
		{ headers: { "Content-Type": "application/x-ndjson" } }
	);
});

app.post("/api/articles/generate-summary", async (c) => {
	const { title, content } = (await c.req.json()) as GenerateSummaryInput;
	const resolvedTitle = title?.trim();
	const resolvedContent = content?.trim() || "";
	if (!resolvedTitle) {
		return c.json({ message: "title required" }, 400);
	}
	const provider = createAIProvider(c.env);
	const userPrompt = `标题：${resolvedTitle}\n正文：\n${resolvedContent}`;
	const summaryRaw = await provider.generateSummary(summaryPrompt, userPrompt);
	const summary = pickFirstLine(summaryRaw).slice(0, 80);
	if (!summary) {
		return c.json({ message: "empty summary" }, 400);
	}
	return c.json({ summary });
});

app.post("/api/articles/generate-tags", async (c) => {
	const { title, content } = (await c.req.json()) as GenerateTagsInput;
	const resolvedTitle = title?.trim();
	const resolvedContent = content?.trim() || "";
	if (!resolvedTitle) {
		return c.json({ message: "title required" }, 400);
	}
	const provider = createAIProvider(c.env);
	const userPrompt = `标题：${resolvedTitle}\n正文：\n${resolvedContent}`;
	const tagsRaw = await provider.generateTags(tagsPrompt, userPrompt);
	const tags = normalizeTags(tagsRaw);
	if (!tags.length) {
		return c.json({ message: "empty tags" }, 400);
	}
	return c.json({ tags });
});

app.post("/api/articles/generate-cover", async (c) => {
	const { title, content } = (await c.req.json()) as GenerateCoverInput;
	const resolvedTitle = title?.trim();
	const resolvedContent = content?.trim() || "";
	if (!resolvedTitle) {
		return c.json({ message: "title required" }, 400);
	}
	const provider = createAIProvider(c.env);
	const userPrompt = `标题：${resolvedTitle}\n摘要：\n正文：\n${resolvedContent}`;
	const coverRaw = await provider.generateImage(coverPrompt, userPrompt);
	const coverImage = pickFirstLine(coverRaw) || fallbackCover;
	return c.json({ coverImage });
});

app.get("/api/articles/:id", async (c) => {
	const article = await getArticle(c.env.DB, c.req.param("id"));
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(article);
});

app.post("/api/articles", async (c) => {
	const payload = (await c.req.json()) as { id?: string; title: string; content: string; summary: string; tags: string[]; coverImage: string; platform: PlatformType };
	if (!payload.title || !payload.content || !payload.summary || !payload.tags?.length || !payload.coverImage || !payload.platform) {
		return c.json({ message: "missing required fields" }, 400);
	}
	const now = Date.now();
	const article = await createArticle(c.env.DB, {
		id: payload.id ?? crypto.randomUUID(),
		title: payload.title,
		content: payload.content,
		summary: payload.summary,
		tags: payload.tags,
		coverImage: payload.coverImage,
		platform: payload.platform,
		status: "draft",
		createdAt: now,
		updatedAt: now,
	});
	await saveDraft(c.env, article.id, article.content);
	await createTask(c.env.DB, {
		id: crypto.randomUUID(),
		type: "generate",
		status: "success",
		payload: { articleId: article.id, platform: payload.platform },
	});
	return c.json(article);
});

app.put("/api/articles/:id", async (c) => {
	const payload = (await c.req.json()) as { title?: string; content?: string; platform?: PlatformType; summary?: string | null; tags?: string[] | null; coverImage?: string | null };
	const article = await updateArticle(c.env.DB, c.req.param("id"), payload);
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	await saveDraft(c.env, article.id, article.content);
	return c.json(article);
});

app.post("/api/articles/:id/transition", async (c) => {
	const { status } = (await c.req.json()) as { status: "reviewed" | "scheduled" | "published" | "failed" };
	const current = await getArticle(c.env.DB, c.req.param("id"));
	if (!current) {
		return c.json({ message: "not found" }, 404);
	}
	if (!canTransition(current.status, status)) {
		return c.json({ message: "invalid transition" }, 400);
	}
	const article = await transitionArticle(c.env.DB, current.id, status);
	return c.json(article);
});

app.post("/api/distribute", async (c) => {
	const { id, platforms } = (await c.req.json()) as { id: string; platforms: PlatformType[] };
	const article = await getArticle(c.env.DB, id);
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	const adapted = platforms
		.map((platform) => {
			const adapter = getPlatformAdapter(platform);
			return `## ${platform}\n\n${adapter.adapt(article.content)}`;
		})
		.join("\n\n");
	await savePublished(c.env, article.id, adapted);
	const updated = await transitionArticle(c.env.DB, article.id, "published");
	await createTask(c.env.DB, {
		id: crypto.randomUUID(),
		type: "publish",
		status: "success",
		payload: { articleId: article.id, platforms },
	});
	return c.json({ article: updated });
});

app.get("/api/prompts", async (c) => {
	const templates = await listPromptTemplates(c.env);
	return c.json(templates);
});

app.put("/api/prompts/:key", async (c) => {
	const key = c.req.param("key") as PromptKey;
	const { template } = (await c.req.json()) as { template: string };
	const result = await setPromptTemplate(c.env, key, template);
	return c.json(result);
});

app.get("/api/ai/status", (c) => {
	return c.json({
		provider: "ollama",
		ready: true,
		lastCheckedAt: Date.now(),
		message: "使用本地 Ollama",
	});
});

export default {
	fetch: app.fetch,
	scheduled: async (_event: unknown, env: Env) => {
		await runDailyCron(env);
	},
};
