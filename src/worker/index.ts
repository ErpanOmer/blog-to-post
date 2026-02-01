import { Hono } from "hono";
import type { Env, GenerateCoverInput, PlatformType, PromptKey } from "./types";
import { createAIProvider } from "./ai/providers";
import { getPlatformAdapter } from "./platform/adapters";
import { listArticles, getArticle, createArticle, updateArticle, deleteArticle } from "./db/articles";
import { listPlatformAccounts, getPlatformAccount, createPlatformAccount, updatePlatformAccount, deletePlatformAccount, verifyPlatformAccount } from "./db/platform-accounts";
import "./accounts";
import { createTask } from "./db/tasks";
import { listPromptTemplates, setPromptTemplate } from "./services/prompts";
import { saveDraft, savePublished } from "./services/storage";
import { canTransition, transitionArticle } from "./services/distribution";
import { runDailyCron } from "./cron";
import { getCachedJuejinTitles } from "./services/juejin-cache";
import { 
  createPublishTaskService, 
  getPublishTaskStatus, 
  cancelPublishTask,
  quickPublish,
  processScheduledTasks 
} from "./services/publish";
import { 
  listArticlePublications, 
  getArticlePublicationsByArticleId,
  listPublishTasks,
  getAccountStatistics,
  listAccountStatistics 
} from "./db/publications";
import type { AccountConfig } from "./types/publications";
import titleSystemPromptRaw from "./prompts/generate-title-system-prompt.txt?raw";
import titleUserPromptTplRaw from "./prompts/generate-title-user-prompt.txt?raw";
import generateContentSystemPrompt from "./prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "./prompts/generate-content-user-prompt.txt?raw";
import summarySystemPrompt from "./prompts/generate-summary-system-prompt.txt?raw";
import summaryUserPromptTpl from "./prompts/generate-summary-user-prompt.txt?raw";
import coverPrompt from "./prompts/cover.prompt.txt?raw";
import localContent from './prompts/conetent.md?raw';



const app = new Hono<{ Bindings: Env }>();
const fallbackCover = "/vite.svg";

export function pickFirstLine(text: string) {
	const line = text.split("\n").find((item) => item.trim());
	return line?.trim() ?? "";
}

export function normalizeTags(text: string) {
	return text
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 6);
}


app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: Date.now() }),
);

app.get("/api/articles", async (c) => {
	const articles = await listArticles(c.env.DB);
	return c.json(articles);
});

app.get("/api/juejin/top", async (c) => {
	const titlesData = await getCachedJuejinTitles(c.env);
	return c.json(titlesData);
});

app.post("/api/articles/generate-title", async (c) => {
	const provider = createAIProvider(c.env);
	
	// 从服务器端缓存获取掘金标题（24小时缓存）
	const titlesData = await getCachedJuejinTitles(c.env);
	const juejinTitles = titlesData.juejinTitles ?? [];
	const userPastTitles = titlesData.userTitles ?? [];
	
	// 构建system prompt，替换变量
	const systemPrompt = titleSystemPromptRaw;
	
	// 构建user prompt，替换变量
	const userPrompt = titleUserPromptTplRaw
		.replace("{{USER_PAST_TITLES}}", userPastTitles.join("\n") || "无数据")
		.replace("{{JUEJIN_TOP_20_TITLES}}", juejinTitles.join("\n") || "无数据");
	
	const titleRaw = await provider.generateTitleText(systemPrompt, userPrompt);
	
	// 解析JSON数组格式的标题
	let titles: string[] = [];
	try {
		// 尝试解析JSON
		const parsed = JSON.parse(titleRaw);
		console.log("解析JSON:", parsed);

		if (Array.isArray(parsed)) {
			titles = parsed.slice(0, 5);
		}
	} catch {
		// 如果不是JSON，按行解析
		titles = titleRaw
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("-") && !line.startsWith("*") && !/^\d+[.)/]/.test(line))
			.slice(0, 5);
	}
	
	return c.json({ titles, count: titles.length });
});

app.post("/api/articles/generate-content", async (c) => {
	if (c.env.ENVIRONMENT === "development") {
		return c.json({ content: localContent });
	}

	const { title } = (await c.req.json()) as { title: string };

	if (!title || !title.trim()) {
		return c.json({ error: "Title is required" }, 400);
	}

	console.log("[generate-content] 开始生成内容，标题:", title);

	const provider = createAIProvider(c.env);
	const userPrompt = generateContentUserPrompt.replace("{{TITLE}}", title);
	const systemPrompt = generateContentSystemPrompt.replace("{{TITLE}}", title);

	console.log("[generate-content] 准备调用 AI Provider");

	try {
		const content = await provider.generateMarkdownContent(systemPrompt, userPrompt);
		return c.json({ content });
	} catch (err) {
		console.error("[generate-content] 生成失败:", err);
		return c.json({ error: String(err) }, 500);
	}
});

app.post("/api/articles/generate-summary", async (c) => {
	const { content } = (await c.req.json()) as { content: string };
	const resolvedContent = content?.trim() || "";
	if (!resolvedContent) {
		return c.json({ message: "content required" }, 400);
	}

	const provider = createAIProvider(c.env);
	const userPrompt = summaryUserPromptTpl.replace("{{ARTICLE_CONTENT}}", resolvedContent);

	try {
		const summaryRaw = await provider.generateSummary(summarySystemPrompt, userPrompt);
		console.log("原始摘要:", summaryRaw);
		// 尝试解析JSON响应
		let summaryData;
		try {
			summaryData = JSON.parse(summaryRaw);
		} catch {
			// 如果解析失败，返回一个默认结构
			summaryData = {
				summary: pickFirstLine(summaryRaw).slice(0, 80) || "无法提取摘要",
				tags: []
			};
		}

		return c.json(summaryData);
	} catch (error) {
		console.error("生成摘要失败:", error);
		return c.json({ message: "生成摘要失败", error: String(error) }, 500);
	}
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
	const payload = (await c.req.json()) as { id?: string; title: string; content: string; summary: string; tags: string[]; coverImage: string; platform?: PlatformType };
	if (!payload.title || !payload.content || !payload.summary || !payload.tags?.length || !payload.coverImage) {
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

app.put("/api/articles/:id", async (c) => {
	const payload = (await c.req.json()) as { title?: string; content?: string; platform?: PlatformType; summary?: string | null; tags?: string[] | null; coverImage?: string | null };
	const article = await updateArticle(c.env.DB, c.req.param("id"), payload);
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	await saveDraft(c.env, article.id, article.content);
	return c.json(article);
});

app.delete("/api/articles/:id", async (c) => {
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

app.get("/api/platform-accounts", async (c) => {
	const platform = c.req.query("platform") as PlatformType | undefined;
	const accounts = await listPlatformAccounts(c.env.DB, platform);
	return c.json(accounts);
});

app.get("/api/platform-accounts/:id", async (c) => {
	const account = await getPlatformAccount(c.env.DB, c.req.param("id"));
	if (!account) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(account);
});

app.post("/api/platform-accounts", async (c) => {
	const payload = (await c.req.json()) as { platform: PlatformType; authToken?: string; description?: string };
	if (!payload.platform) {
		return c.json({ message: "platform is required" }, 400);
	}
	const now = Date.now();
	const { account, verifyResult, isDuplicate } = await createPlatformAccount(c.env.DB, {
		id: crypto.randomUUID(),
		platform: payload.platform,
		authToken: payload.authToken ?? null,
		description: payload.description ?? null,
		createdAt: now,
		updatedAt: now,
	});

	if (!account) {
		return c.json(
			{ message: verifyResult.message, valid: verifyResult.valid },
			verifyResult.valid ? 200 : 400,
		);
	}

	return c.json({
		...account,
		verifyMessage: verifyResult.message,
		isVerified: verifyResult.valid,
		isDuplicate,
	});
});

app.put("/api/platform-accounts/:id", async (c) => {
	const payload = (await c.req.json()) as { authToken?: string | null; description?: string | null; isActive?: boolean };
	const account = await updatePlatformAccount(c.env.DB, c.req.param("id"), payload);
	if (!account) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(account);
});

app.post("/api/platform-accounts/:id/verify", async (c) => {
	const result = await verifyPlatformAccount(c.env.DB, c.req.param("id"));
	return c.json(result);
});

app.delete("/api/platform-accounts/:id", async (c) => {
	const success = await deletePlatformAccount(c.env.DB, c.req.param("id"));
	if (!success) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json({ success: true });
});

// ==================== 文章发布 API ====================

// 创建发布任务（支持批量发布和定时发布）
app.post("/api/publish/tasks", async (c) => {
	try {
		const { articleIds, accountConfigs, scheduleTime } = await c.req.json() as { 
			articleIds: string[]; 
			accountConfigs: AccountConfig[];
			scheduleTime?: number | null;
		};

		if (!articleIds?.length || !accountConfigs?.length) {
			return c.json({ message: "文章ID列表和账号配置不能为空" }, 400);
		}

		// 至少选择一个账号
		if (accountConfigs.length === 0) {
			return c.json({ message: "至少选择一个发布账号" }, 400);
		}

		const result = await createPublishTaskService(c.env.DB, {
			articleIds,
			accountConfigs,
			scheduleTime,
		});

		return c.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "创建发布任务失败";
		return c.json({ message }, 400);
	}
});

// 获取发布任务列表
app.get("/api/publish/tasks", async (c) => {
	try {
		const status = c.req.query("status") as "pending" | "processing" | "completed" | "failed" | "cancelled" | undefined;
		const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
		
		const tasks = await listPublishTasks(c.env.DB, { status, limit });
		return c.json(tasks);
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取任务列表失败";
		return c.json({ message }, 500);
	}
});

// 获取单个发布任务详情
app.get("/api/publish/tasks/:id", async (c) => {
	try {
		const { task, steps } = await getPublishTaskStatus(c.env.DB, c.req.param("id"));
		return c.json({ task, steps });
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取任务详情失败";
		return c.json({ message }, 404);
	}
});

// 取消发布任务
app.post("/api/publish/tasks/:id/cancel", async (c) => {
	try {
		const result = await cancelPublishTask(c.env.DB, c.req.param("id"));
		return c.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "取消任务失败";
		return c.json({ message, success: false }, 500);
	}
});

// 快速发布（单篇文章到单个账号）
app.post("/api/publish/quick", async (c) => {
	try {
		const { articleId, accountId, draftOnly = false } = await c.req.json() as {
			articleId: string;
			accountId: string;
			draftOnly?: boolean;
		};

		if (!articleId || !accountId) {
			return c.json({ message: "文章ID和账号ID不能为空", success: false }, 400);
		}

		const result = await quickPublish(c.env.DB, articleId, accountId, draftOnly);
		return c.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "快速发布失败";
		return c.json({ message, success: false }, 500);
	}
});

// 获取文章的发布记录
app.get("/api/articles/:id/publications", async (c) => {
	try {
		const publications = await getArticlePublicationsByArticleId(c.env.DB, c.req.param("id"));
		return c.json(publications);
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取发布记录失败";
		return c.json({ message }, 500);
	}
});

// 获取所有发布记录（支持筛选）
app.get("/api/publications", async (c) => {
	try {
		const articleId = c.req.query("articleId");
		const accountId = c.req.query("accountId");
		const platform = c.req.query("platform") as PlatformType | undefined;
		const status = c.req.query("status") as "pending" | "draft_created" | "publishing" | "published" | "failed" | "cancelled" | undefined;
		
		const publications = await listArticlePublications(c.env.DB, { 
			articleId, 
			accountId, 
			platform, 
			status 
		});
		return c.json(publications);
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取发布记录失败";
		return c.json({ message }, 500);
	}
});

// ==================== 账号统计 API ====================

// 获取所有账号的发布统计
app.get("/api/account-statistics", async (c) => {
	try {
		const platform = c.req.query("platform") as PlatformType | undefined;
		const statistics = await listAccountStatistics(c.env.DB, platform);
		return c.json(statistics);
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取账号统计失败";
		return c.json({ message }, 500);
	}
});

// 获取单个账号的发布统计
app.get("/api/platform-accounts/:id/statistics", async (c) => {
	try {
		const statistics = await getAccountStatistics(c.env.DB, c.req.param("id"));
		if (!statistics) {
			return c.json({ message: "暂无统计数据" }, 404);
		}
		return c.json(statistics);
	} catch (error) {
		const message = error instanceof Error ? error.message : "获取账号统计失败";
		return c.json({ message }, 500);
	}
});

export default {
	fetch: app.fetch,
	scheduled: async (_event: unknown, env: Env) => {
		// 执行定时发布任务
		await processScheduledTasks(env.DB);
		// 执行日常定时任务
		await runDailyCron(env);
	},
};
