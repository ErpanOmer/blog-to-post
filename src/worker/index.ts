import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/worker/types";
import { runDailyCron } from "@/worker/cron";
import { processScheduledTasks } from "@/worker/services/publish";

// Import modular routes
import articlesApp from "@/worker/routes/articles";
import accountsApp from "@/worker/routes/accounts";
import publishApp from "@/worker/routes/publish";

const app = new Hono<{ Bindings: Env }>();

// ==================== 中间件 ====================

// CORS 中间件
app.use("/api/*", cors({
	origin: (origin, c) => {
		if (c.env.ENVIRONMENT === "development") {
			return origin || "*";
		}
		return origin || "";
	},
	allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization"],
	exposeHeaders: ["Content-Length"],
	maxAge: 86400,
}));

// ==================== 全局错误处理 ====================
app.onError((err, c) => {
	const statusCode = "status" in err && typeof err.status === "number" ? err.status : 500;
	const errorCode = err.name || "INTERNAL_ERROR";
	const message = err.message || "服务器内部错误";

	console.error(`[${new Date().toISOString()}] ${errorCode}: ${message}`);
	if (err.stack) {
		console.error(err.stack);
	}

	return c.json({
		success: false,
		error_code: errorCode,
		message: message,
		timestamp: Date.now(),
	}, statusCode as 400 | 401 | 403 | 404 | 500);
});

app.notFound((c) => {
	return c.json({
		success: false,
		error_code: "NOT_FOUND",
		message: `路径 ${c.req.path} 不存在`,
		timestamp: Date.now(),
	}, 404);
});

// ==================== 路由挂载 ====================

// 健康检查
app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: Date.now() }),
);

// 挂载模块化路由
// Articles: /api/articles, /api/juejin/top
// 注意：articlesApp 内部处理了 /api/articles 下的路径，但挂载时如果用 /api/articles，
// 内部的 app.get('/') 对应的就是 /api/articles
// 内部的 app.get('/search') 对应的就是 /api/articles/search
// 唯一的例外是 /api/articles/generate-title 等，它们虽然在 articles.ts，但逻辑上属于 article 相关的操作
// 以及 /api/juejin/top 被移到了 articlesApp，我们需要确保路径正确
// 为了简单起见，articlesApp 处理 /api/articles 前缀下的所有请求
import aiApp from "@/worker/routes/ai";

app.route("/api/articles", articlesApp);
app.route("/api/accounts", accountsApp);
app.route("/api/publish", publishApp);
app.route("/api/ai", aiApp);

// 注意：原先的 /api/juejin/top 在 index.ts 中是根路径，
// 如果要在 articlesApp 中保留并在 /api/articles 下访问，路径变为了 /api/articles/juejin/top
// 这里需要确认 api.ts 中的调用路径。
// 查看前端 api.ts，可能是直接调用的 /api/juejin/top?
// 如果是这样，我们需要单独处理，或者让 articlesApp 挂载到更根的路径？
// 更好的做法是：保持 API 路径不变。
// articlesApp 处理 /api/articles/*
// accountsApp 处理 /api/accounts/*
// publishApp 处理 /api/publish/*

// 唯一的问题是 /api/juejin/top。
// 我将其放在 articlesApp 中并以 /juejin/top 路径暴露，这意味着现在的 URL 是 /api/articles/juejin/top
// 这改变了 API。为了兼容，我可以在这里单独挂载，或者重定向。
// 让我们为了这种一次性路由，直接在 index.ts 中保留它或者重定向。

// 修正：将 /api/juejin/top 重定向到新路径，或者在 articlesApp 中移除它，单独放回这里。
// 为了代码整洁，我还是把它放回 index.ts 吧，或者创建一个 routes/misc.ts。
// 鉴于它只是一行代码，也可以用代理：
import { getCachedJuejinTitles } from "@/worker/services/juejin-cache";
app.get("/api/juejin/top", async (c) => {
	const titlesData = await getCachedJuejinTitles(c.env);
	return c.json(titlesData);
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
