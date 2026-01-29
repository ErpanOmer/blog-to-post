import { Hono } from "hono";
import type { Env, GenerateInput, PlatformType } from "./types";
import { createAIProvider } from "./ai/providers";
import { getPlatformAdapter } from "./platform/adapters";
import { listArticles, getArticle, createArticle, updateArticle } from "./db/articles";
import { createTask } from "./db/tasks";
import { listPromptTemplates, setPromptTemplate } from "./services/prompts";
import { saveDraft, savePublished } from "./services/storage";
import { canTransition, transitionArticle } from "./services/distribution";
import { runDailyCron } from "./cron";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: Date.now() }),
);

app.get("/api/articles", async (c) => {
	const articles = await listArticles(c.env.DB);
	return c.json(articles);
});

app.post("/api/articles/generate", async (c) => {
	const input = (await c.req.json()) as GenerateInput;
	const provider = createAIProvider(c.env);
	const content = await provider.generateArticle(input);
	const id = crypto.randomUUID();
	const now = Date.now();
	const article = await createArticle(c.env.DB, {
		id,
		title: input.title,
		content,
		platform: input.platform,
		status: "draft",
		createdAt: now,
		updatedAt: now,
	});
	await saveDraft(c.env, id, content);
	await createTask(c.env.DB, {
		id: crypto.randomUUID(),
		type: "generate",
		status: "success",
		payload: { articleId: id, platform: input.platform },
	});
	return c.json(article);
});

app.get("/api/articles/:id", async (c) => {
	const article = await getArticle(c.env.DB, c.req.param("id"));
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(article);
});

app.put("/api/articles/:id", async (c) => {
	const payload = (await c.req.json()) as { title?: string; content?: string; platform?: PlatformType };
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
	const key = c.req.param("key") as PlatformType;
	const { template } = (await c.req.json()) as { template: string };
	const result = await setPromptTemplate(c.env, key, template);
	return c.json(result);
});

app.get("/api/ai/status", (c) => {
	const provider = c.env.AI_PROVIDER ?? "cloudflare";
	return c.json({
		provider,
		ready: true,
		lastCheckedAt: Date.now(),
		message: provider === "ollama" ? "使用本地 Ollama" : "使用 Cloudflare AI",
	});
});

export default {
	fetch: app.fetch,
	scheduled: async (_event: unknown, env: Env) => {
		await runDailyCron(env);
	},
};
