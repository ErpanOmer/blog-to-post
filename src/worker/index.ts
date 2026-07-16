import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/worker/types";
import { runDailyCron } from "@/worker/cron";
import { processScheduledTasks } from "@/worker/services/publish";
import { setAccountServiceRuntimeEnv } from "@/worker/accounts/registry";

import articlesApp from "@/worker/routes/articles";
import accountsApp from "@/worker/routes/accounts";
import publishApp from "@/worker/routes/publish";
import settingsApp from "@/worker/routes/settings";
import aiApp from "@/worker/routes/ai";
import websiteApp from "@/worker/routes/website";
import { getCachedJuejinTitles } from "@/worker/services/juejin-cache";

const app = new Hono<{ Bindings: Env }>();

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

app.use("*", async (c, next) => {
	setAccountServiceRuntimeEnv(c.env);
	await next();
});

app.onError((err, c) => {
	const statusCode = "status" in err && typeof err.status === "number" ? err.status : 500;
	const errorCode = err.name || "INTERNAL_ERROR";
	const message = err.message || "服务器内部错误";

	if (typeof message === "string" && message.includes("no such table")) {
		return c.json(
			{
				success: false,
				error_code: "DB_NOT_INITIALIZED",
				message: "数据库表不存在。请先初始化 D1：本地运行 `npm run db:init -- --local`，线上运行 `npm run db:init -- --remote`。",
				timestamp: Date.now(),
			},
			503,
		);
	}

	console.error(`[${new Date().toISOString()}] ${errorCode}: ${message}`);
	if (err.stack) {
		console.error(err.stack);
	}

	return c.json({
		success: false,
		error_code: errorCode,
		message,
		timestamp: Date.now(),
	}, statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503 | 504);
});

app.notFound((c) => {
	return c.json({
		success: false,
		error_code: "NOT_FOUND",
		message: `路径 ${c.req.path} 不存在`,
		timestamp: Date.now(),
	}, 404);
});

app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: Date.now() }),
);

app.route("/api/articles", articlesApp);
app.route("/api/accounts", accountsApp);
app.route("/api/publish", publishApp);
app.route("/api/settings", settingsApp);
app.route("/api/ai", aiApp);
app.route("/api/website", websiteApp);

app.get("/api/juejin/top", async (c) => {
	const titlesData = await getCachedJuejinTitles(c.env);
	return c.json(titlesData);
});

export default {
	fetch: app.fetch,
	scheduled: async (_event: unknown, env: Env) => {
		setAccountServiceRuntimeEnv(env);
		await processScheduledTasks(env.DB, {
			encryptionKey: env.ENCRYPTION_KEY,
			env,
		});
		await runDailyCron(env);
	},
};
