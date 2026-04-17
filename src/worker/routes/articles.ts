import { Hono } from "hono";
import type { Env, PlatformType, GenerateCoverInput } from "@/worker/types";
import { canTransition } from "@/worker/services/distribution";
import {
	listArticles,
	getArticle,
	createArticle,
	updateArticle,
	deleteArticle,
} from "@/worker/db/articles";
import { saveDraft } from "@/worker/services/storage";
import { createTask } from "@/worker/db/tasks";
import { createAIProvider } from "@/worker/ai/providers";
import { getCachedJuejinTitles } from "@/worker/services/juejin-cache";
import { transitionArticle } from "@/worker/services/distribution";
import { getArticlePublicationsByArticleId } from "@/worker/db/publications";
import { extractStringArray, safeParseJson } from "@/worker/utils/json-parser";
import { pickFirstLine } from "@/worker/utils/text";
import type { ArticleAISettings } from "@/worker/types";

import titleSystemPromptRaw from "@/worker/prompts/generate-title-system-prompt.txt?raw";
import titleUserPromptTplRaw from "@/worker/prompts/generate-title-user-prompt.txt?raw";
import generateContentSystemPrompt from "@/worker/prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "@/worker/prompts/generate-content-user-prompt.txt?raw";
import coverPrompt from "@/worker/prompts/cover.prompt.txt?raw";
import localContent from "@/worker/prompts/conetent.md?raw";

const app = new Hono<{ Bindings: Env }>();
const fallbackCover = "/vite.svg";
const defaultArticleAISettings: ArticleAISettings = {
	model: "kimi-k2.5:cloud",
	temperature: 0.2,
	topP: 0.9,
	maxTokens: 512,
	requestTimeoutSec: 120,
	summaryPrompt: "请基于文章内容生成简洁摘要。输出纯文本，不超过80个汉字。",
	tagsPrompt: "请基于文章内容生成3-8个技术标签。优先技术名词，标签尽量简短。输出JSON：{\"tags\":[\"标签1\",\"标签2\"]}",
};

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

function normalizeString(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim();
	return trimmed || fallback;
}

function normalizeArticleAISettings(input?: unknown): ArticleAISettings {
	if (!input || typeof input !== "object") {
		return defaultArticleAISettings;
	}
	const source = input as Partial<ArticleAISettings>;
	return {
		model: normalizeString(source.model, defaultArticleAISettings.model),
		temperature: normalizeNumber(source.temperature, defaultArticleAISettings.temperature, 0, 2),
		topP: normalizeNumber(source.topP, defaultArticleAISettings.topP, 0, 1),
		maxTokens: normalizeNumber(source.maxTokens, defaultArticleAISettings.maxTokens, 64, 32768),
		requestTimeoutSec: normalizeNumber(source.requestTimeoutSec, defaultArticleAISettings.requestTimeoutSec, 10, 600),
		summaryPrompt: normalizeString(source.summaryPrompt, defaultArticleAISettings.summaryPrompt),
		tagsPrompt: normalizeString(source.tagsPrompt, defaultArticleAISettings.tagsPrompt),
	};
}

function resolvePromptInput(template: string, content: string): {
	systemPrompt: string;
	userPrompt: string;
} {
	const marker = "{{ARTICLE_CONTENT}}";
	if (template.includes(marker)) {
		return {
			systemPrompt: template.split(marker).join(content),
			userPrompt: "",
		};
	}

	return {
		systemPrompt: template,
		userPrompt: content,
	};
}

function normalizeSummaryText(text: string): string {
	const collapsed = text
		.replace(/\r/g, "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");

	return collapsed
		.replace(/^#+\s*/, "")
		.replace(/^["'`]+|["'`]+$/g, "")
		.trim();
}

function extractSummaryText(summaryRaw: string): string {
	const parsed = safeParseJson<{ summary?: unknown } | string | null>(summaryRaw, null);

	let candidate = "";
	if (typeof parsed === "string") {
		candidate = parsed;
	} else if (parsed && typeof parsed.summary === "string") {
		candidate = parsed.summary;
	}

	if (!candidate) {
		candidate = pickFirstLine(summaryRaw);
	}

	return normalizeSummaryText(candidate);
}

// Get article list
app.get("/", async (c) => {
	const articles = await listArticles(c.env.DB);
	return c.json(articles);
});

// Search articles
app.get("/search", async (c) => {
	const query = c.req.query("q")?.trim() ?? "";
	if (!query) {
		return c.json([]);
	}
	const articles = await listArticles(c.env.DB);
	const lowered = query.toLowerCase();
	const filtered = articles.filter((article) =>
		article.title.toLowerCase().includes(lowered)
		|| article.content.toLowerCase().includes(lowered)
		|| article.summary?.toLowerCase().includes(lowered),
	);
	return c.json(filtered);
});

// Juejin top titles
app.get("/juejin/top", async (c) => {
	const titlesData = await getCachedJuejinTitles(c.env);
	return c.json(titlesData);
});

// Generate title
app.post("/generate-title", async (c) => {
	const provider = createAIProvider(c.env);
	const titlesData = await getCachedJuejinTitles(c.env);
	const juejinTitles = titlesData.juejinTitles ?? [];
	const userPastTitles = titlesData.userTitles ?? [];

	const systemPrompt = titleSystemPromptRaw;
	const userPrompt = titleUserPromptTplRaw
		.replace("{{USER_PAST_TITLES}}", userPastTitles.join("\n") || "no-data")
		.replace("{{JUEJIN_TOP_20_TITLES}}", juejinTitles.join("\n") || "no-data");

	const titleRaw = await provider.generateTitleText(systemPrompt, userPrompt);
	const titles = extractStringArray(titleRaw, 5);

	return c.json({ titles, count: titles.length });
});

// Generate content
app.post("/generate-content", async (c) => {
	if (c.env.ENVIRONMENT === "development") {
		return c.json({ content: localContent });
	}

	const { title } = (await c.req.json()) as { title: string };
	if (!title || !title.trim()) {
		return c.json({ error: "Title is required" }, 400);
	}

	const provider = createAIProvider(c.env);
	const userPrompt = generateContentUserPrompt.replace("{{TITLE}}", title);
	const systemPrompt = generateContentSystemPrompt.replace("{{TITLE}}", title);

	try {
		const content = await provider.generateMarkdownContent(systemPrompt, userPrompt);
		return c.json({ content });
	} catch (err) {
		console.error("[generate-content] generation failed:", err);
		return c.json({ error: String(err) }, 500);
	}
});

// Generate summary
app.post("/generate-summary", async (c) => {
	const payload = (await c.req.json()) as { content: string; settings?: unknown };
	const { content } = payload;
	const resolvedContent = content?.trim() || "";
	if (!resolvedContent) {
		return c.json({ message: "content required" }, 400);
	}

	const provider = createAIProvider(c.env);

	try {
		const settings = normalizeArticleAISettings(payload.settings);
		const prompt = resolvePromptInput(settings.summaryPrompt, resolvedContent);
		const summaryRaw = await provider.generateSummary(
			prompt.systemPrompt,
			prompt.userPrompt,
			{
				model: settings.model,
				temperature: settings.temperature,
				topP: settings.topP,
				maxTokens: settings.maxTokens,
				requestTimeoutSec: settings.requestTimeoutSec,
				think: false,
			},
		);

		const summary = extractSummaryText(summaryRaw);

		return c.json({ summary });
	} catch (error) {
		console.error("generate summary failed:", error);
		return c.json({ message: "generate summary failed", error: String(error) }, 500);
	}
});
// Generate tags
app.post("/generate-tags", async (c) => {
	const payload = (await c.req.json()) as { content: string; settings?: unknown };
	const { content } = payload;
	const resolvedContent = content?.trim() || "";
	if (!resolvedContent) {
		return c.json({ message: "content required" }, 400);
	}

	const provider = createAIProvider(c.env);

	try {
		const settings = normalizeArticleAISettings(payload.settings);
		const prompt = resolvePromptInput(settings.tagsPrompt, resolvedContent);
		const tagsRaw = await provider.generateTags(
			prompt.systemPrompt,
			prompt.userPrompt,
			{
				model: settings.model,
				temperature: settings.temperature,
				topP: settings.topP,
				maxTokens: settings.maxTokens,
				requestTimeoutSec: settings.requestTimeoutSec,
				format: "json",
				think: false,
			},
		);

		console.log(tagsRaw)

		const parsed = safeParseJson<{ tags?: unknown } | string[] | null>(tagsRaw, null);

		let tags: string[] = [];
		let explicitEmptyTags = false;
		if (Array.isArray(parsed)) {
			tags = parsed.map((item) => String(item).trim()).filter(Boolean);
			explicitEmptyTags = parsed.length === 0;
		} else if (parsed && Array.isArray(parsed.tags)) {
			tags = parsed.tags.map((item) => String(item).trim()).filter(Boolean);
			explicitEmptyTags = parsed.tags.length === 0;
		}

		// If the model explicitly returns {"tags":[]}, keep it empty.
		if (tags.length === 0 && !explicitEmptyTags) {
			tags = extractStringArray(tagsRaw, 10)
				.flatMap((item) => item.split(/[\u002c\uFF0C\u3001]/))
				.map((item) => item.trim())
				.filter(Boolean);
		}

		return c.json({ tags: [...new Set(tags)].slice(0, 8) });
	} catch (error) {
		console.error("generate tags failed:", error);
		return c.json({ message: "generate tags failed", error: String(error) }, 500);
	}
});
// Generate cover
app.post("/generate-cover", async (c) => {
	const { title, content } = (await c.req.json()) as GenerateCoverInput;
	const resolvedTitle = title?.trim();
	const resolvedContent = content?.trim() || "";
	if (!resolvedTitle) {
		return c.json({ message: "title required" }, 400);
	}
	const provider = createAIProvider(c.env);
	const userPrompt = `title: ${resolvedTitle}\nsummary:\ncontent:\n${resolvedContent}`;
	const coverRaw = await provider.generateImage(coverPrompt, userPrompt);
	const coverImage = pickFirstLine(coverRaw) || fallbackCover;
	return c.json({ coverImage });
});

// Get single article
app.get("/:id", async (c) => {
	const article = await getArticle(c.env.DB, c.req.param("id"));
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(article);
});

// Create article
app.post("/", async (c) => {
	const payload = (await c.req.json()) as {
		id?: string;
		title: string;
		content: string;
		htmlContent?: string;
		summary: string;
		tags: string[];
		coverImage: string;
		platform?: PlatformType;
	};
	if (!payload.title || !payload.content || !payload.summary || !payload.tags?.length || !payload.coverImage) {
		return c.json({ message: "missing required fields" }, 400);
	}
	const now = Date.now();
	const article = await createArticle(c.env.DB, {
		id: payload.id ?? crypto.randomUUID(),
		title: payload.title,
		content: payload.content,
		summary: payload.summary,
		htmlContent: payload.htmlContent,
		tags: payload.tags,
		coverImage: payload.coverImage,
		platform: payload.platform ?? "",
		status: "draft",
		createdAt: now,
		updatedAt: now,
	});
	await saveDraft(c.env, article.id, article.content);
	await createTask(c.env.DB, {
		id: crypto.randomUUID(),
		type: "generate",
		status: "success",
		payload: { articleId: article.id },
	});
	return c.json(article);
});

// Update article
app.put("/:id", async (c) => {
	const payload = (await c.req.json()) as {
		title?: string;
		content?: string;
		htmlContent?: string;
		platform?: PlatformType;
		summary?: string | null;
		tags?: string[] | null;
		coverImage?: string | null;
	};
	const article = await updateArticle(c.env.DB, c.req.param("id"), payload);
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	await saveDraft(c.env, article.id, article.content);
	return c.json(article);
});

// Delete article
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const current = await getArticle(c.env.DB, id);
	if (!current) {
		return c.json({ message: "not found" }, 404);
	}
	if (current.status !== "draft") {
		return c.json({ message: "only draft articles can be deleted" }, 400);
	}
	const success = await deleteArticle(c.env.DB, id);
	if (!success) {
		return c.json({ message: "delete failed" }, 500);
	}
	return c.json({ success: true });
});

// Transition article status
app.post("/:id/transition", async (c) => {
	const { status } = (await c.req.json()) as {
		status: "reviewed" | "scheduled" | "published" | "failed";
	};
	const current = await getArticle(c.env.DB, c.req.param("id"));

	if (!current) {
		return c.json({ message: "not found" }, 404);
	}

	const canMove = canTransition(current.status, status);
	if (!canMove) {
		return c.json({ message: `Cannot transition from ${current.status} to ${status}` }, 400);
	}

	const result = await transitionArticle(c.env.DB, current.id, status);
	return c.json(result);
});

// Get article publications
app.get("/:id/publications", async (c) => {
	try {
		const publications = await getArticlePublicationsByArticleId(c.env.DB, c.req.param("id"));
		return c.json(publications);
	} catch (error) {
		const message = error instanceof Error ? error.message : "failed to get publications";
		return c.json({ message }, 500);
	}
});

export default app;
