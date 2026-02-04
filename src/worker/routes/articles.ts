import { Hono } from "hono";
import type { Env, PlatformType, GenerateCoverInput } from "@/worker/types";
import { canTransition } from "@/worker/services/distribution";
import {
    listArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle
} from "@/worker/db/articles";
import { saveDraft } from "@/worker/services/storage";
import { createTask } from "@/worker/db/tasks";
import { createAIProvider } from "@/worker/ai/providers";
import { getCachedJuejinTitles } from "@/worker/services/juejin-cache";
import { transitionArticle } from "@/worker/services/distribution";
import { getArticlePublicationsByArticleId } from "@/worker/db/publications";
import { extractStringArray, safeParseJson } from "@/worker/utils/json-parser";
import { pickFirstLine } from "@/worker/utils/text";

import titleSystemPromptRaw from "@/worker/prompts/generate-title-system-prompt.txt?raw";
import titleUserPromptTplRaw from "@/worker/prompts/generate-title-user-prompt.txt?raw";
import generateContentSystemPrompt from "@/worker/prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "@/worker/prompts/generate-content-user-prompt.txt?raw";
import summarySystemPrompt from "@/worker/prompts/generate-summary-system-prompt.txt?raw";
import summaryUserPromptTpl from "@/worker/prompts/generate-summary-user-prompt.txt?raw";
import coverPrompt from "@/worker/prompts/cover.prompt.txt?raw";
import localContent from '@/worker/prompts/conetent.md?raw';

const app = new Hono<{ Bindings: Env }>();
const fallbackCover = "/vite.svg";

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
    const filtered = articles.filter((article) =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase()) ||
        article.summary?.toLowerCase().includes(query.toLowerCase())
    );
    return c.json(filtered);
});

// Juejin top titles (moved from root since it's article related)
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
        .replace("{{USER_PAST_TITLES}}", userPastTitles.join("\n") || "无数据")
        .replace("{{JUEJIN_TOP_20_TITLES}}", juejinTitles.join("\n") || "无数据");

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
        console.error("[generate-content] 生成失败:", err);
        return c.json({ error: String(err) }, 500);
    }
});

// Generate summary
app.post("/generate-summary", async (c) => {
    const { content } = (await c.req.json()) as { content: string };
    const resolvedContent = content?.trim() || "";
    if (!resolvedContent) {
        return c.json({ message: "content required" }, 400);
    }

    const provider = createAIProvider(c.env);
    const userPrompt = summaryUserPromptTpl.replace("{{ARTICLE_CONTENT}}", resolvedContent);

    try {
        const summaryRaw = await provider.generateSummary(summarySystemPrompt, userPrompt);
        const defaultSummary = {
            summary: pickFirstLine(summaryRaw).slice(0, 80) || "无法提取摘要",
            tags: [] as string[]
        };
        const summaryData = safeParseJson(summaryRaw, defaultSummary);
        return c.json(summaryData);
    } catch (error) {
        console.error("生成摘要失败:", error);
        return c.json({ message: "生成摘要失败", error: String(error) }, 500);
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
    const userPrompt = `标题：${resolvedTitle}\n摘要：\n正文：\n${resolvedContent}`;
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
    const payload = (await c.req.json()) as { id?: string; title: string; content: string; htmlContent?: string; summary: string; tags: string[]; coverImage: string; platform?: PlatformType };
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
    const payload = (await c.req.json()) as { title?: string; content?: string; htmlContent?: string; platform?: PlatformType; summary?: string | null; tags?: string[] | null; coverImage?: string | null };
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
    // 只允许删除草稿状态的文章
    if (current.status !== 'draft') {
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
    const { status } = (await c.req.json()) as { status: "reviewed" | "scheduled" | "published" | "failed" };
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
        const message = error instanceof Error ? error.message : "获取发布记录失败";
        return c.json({ message }, 500);
    }
});

export default app;
