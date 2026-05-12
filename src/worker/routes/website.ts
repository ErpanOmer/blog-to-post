import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "@/worker/types";
import { getPlatformAccount, listPlatformAccounts } from "@/worker/db/platform-accounts";
import WebsiteAccountService, {
	type WebsitePostPayload,
	type WebsitePostListResult,
	type WebsitePost,
type WebsiteCredential,
} from "@/worker/accounts/website";

const app = new Hono<{ Bindings: Env }>();
type WebsiteSource = "local" | "remote";

const LOCAL_WEBSITE_BASE_URL = "http://localhost:4321";
const REMOTE_WEBSITE_BASE_URL = "https://erpanomer.nurverse.com";

function jsonSuccess<T>(data: T) {
	return { success: true, data };
}

function jsonMessage(success: boolean, message: string) {
	return { success, message };
}

function parseBoolean(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	return value === "true" || value === "1";
}

function normalizeLimit(value: string | undefined): number {
	const parsed = value ? Number.parseInt(value, 10) : 20;
	if (!Number.isFinite(parsed) || parsed <= 0) return 20;
	return Math.min(parsed, 100);
}

function normalizeCursor(value: string | undefined): number {
	const parsed = value ? Number.parseInt(value, 10) : 0;
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}

function parseWebsiteSource(value: string | undefined): WebsiteSource | undefined {
	if (value === "local" || value === "remote") return value;
	return undefined;
}

function isProductionEnv(env: Env): boolean {
	return env.ENVIRONMENT === "production";
}

function buildDefaultWebsiteCredential(env: Env, source?: WebsiteSource): WebsiteCredential {
	const requestedSource = source ?? (isProductionEnv(env) ? "remote" : "local");
	if (requestedSource === "local" && isProductionEnv(env)) {
		throw new Error("Local website data source is unavailable in production.");
	}

	return {
		baseUrl: requestedSource === "remote"
			? REMOTE_WEBSITE_BASE_URL
			: (env.WEBSITE_BASE_URL || LOCAL_WEBSITE_BASE_URL),
		adminToken: env.WEBSITE_ADMIN_TOKEN || (requestedSource === "local" ? "dev-website-admin-token" : ""),
		author: "ErpanOmer",
	};
}

function readWebsiteBaseUrlFromToken(authToken?: string | null): string {
	if (!authToken?.trim()) return "";
	try {
		const parsed = JSON.parse(authToken) as Partial<WebsiteCredential> & { siteUrl?: string };
		return (parsed.baseUrl || parsed.siteUrl || "").trim().replace(/\/+$/, "");
	} catch {
		return "";
	}
}

function sourceMatchesAccount(authToken: string | null | undefined, source: WebsiteSource): boolean {
	const baseUrl = readWebsiteBaseUrlFromToken(authToken).toLowerCase();
	if (!baseUrl) return false;
	if (source === "local") {
		return baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
	}
	return baseUrl.includes("erpanomer.nurverse.com");
}

async function resolveWebsiteService(
	env: Env,
	accountId?: string | null,
	source?: WebsiteSource,
): Promise<{ service: WebsiteAccountService; accountId: string }> {
	if (source === "local" && isProductionEnv(env)) {
		throw new Error("Local website data source is unavailable in production.");
	}

	const accounts = accountId
		? [await getPlatformAccount(env.DB, accountId, env.ENCRYPTION_KEY)]
		: await listPlatformAccounts(env.DB, "website", env.ENCRYPTION_KEY);

	const account = accountId
		? accounts[0]
		: accounts.find((item) =>
			item?.isActive
			&& item.isVerified
			&& item.authToken
			&& (!source || sourceMatchesAccount(item.authToken, source))
		) ?? (!source ? accounts.find((item) => item?.isActive && item.isVerified && item.authToken) : undefined);

	if (!account) {
		const credential = buildDefaultWebsiteCredential(env, source);
		if (!credential.adminToken) {
			throw new Error(`No verified website account found for ${source ?? "default"} data source.`);
		}
		return {
			service: new WebsiteAccountService(JSON.stringify(credential), env),
			accountId: `website-${source ?? (isProductionEnv(env) ? "remote" : "local")}-default`,
		};
	}

	if (!account) {
		throw new Error("No verified website account found. Please add a website account first.");
	}
	if (account.platform !== "website") {
		throw new Error("Selected account is not a website account.");
	}
	if (!account.isActive) {
		throw new Error("Website account is inactive.");
	}
	if (!account.isVerified) {
		throw new Error("Website account is not verified.");
	}
	if (!account.authToken) {
		throw new Error("Website account token is missing.");
	}

	return {
		service: new WebsiteAccountService(account.authToken, env),
		accountId: account.id,
	};
}

async function handleRoute<T>(
	c: Context<{ Bindings: Env }>,
	handler: () => Promise<T>,
) {
	try {
		const data = await handler();
		return c.json(jsonSuccess(data));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Website API request failed";
		const status = message.toLowerCase().includes("not found") ? 404 : 500;
		return c.json(jsonMessage(false, message), status as 404 | 500);
	}
}

app.get("/accounts", async (c) => {
	const accounts = await listPlatformAccounts(c.env.DB, "website", c.env.ENCRYPTION_KEY);
	return c.json(jsonSuccess(accounts.map((account) => ({
		id: account.id,
		userName: account.userName,
		description: account.description,
		isActive: account.isActive,
		isVerified: account.isVerified,
		lastVerifiedAt: account.lastVerifiedAt,
	}))));
});

app.get("/posts", async (c) => {
	return handleRoute<WebsitePostListResult>(c, async () => {
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.websitePostList({
			status: (c.req.query("status") as "all" | "draft" | "published" | undefined) ?? "all",
			limit: normalizeLimit(c.req.query("limit")),
			cursor: normalizeCursor(c.req.query("cursor")),
			q: c.req.query("q"),
			tag: c.req.query("tag"),
			includeDeleted: parseBoolean(c.req.query("includeDeleted")),
			sortBy: c.req.query("sortBy") === "updatedAt" ? "updatedAt" : "createdAt",
			sortOrder: c.req.query("sortOrder") === "asc" ? "asc" : "desc",
		});
	});
});

app.post("/posts", async (c) => {
	return handleRoute(c, async () => {
		const payload = await c.req.json<WebsitePostPayload>();
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.websitePostCreate(payload);
	});
});

app.get("/posts/:slug", async (c) => {
	return handleRoute<WebsitePost | null>(c, async () => {
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		const post = await service.websitePostDetail(c.req.param("slug"));
		if (!post) {
			throw new Error("Website post not found");
		}
		return post;
	});
});

app.put("/posts/:slug", async (c) => {
	return handleRoute(c, async () => {
		const payload = await c.req.json<Partial<WebsitePostPayload>>();
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.websitePostUpdate(c.req.param("slug"), payload);
	});
});

app.delete("/posts/:slug", async (c) => {
	return handleRoute(c, async () => {
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.articleDelete(c.req.param("slug"));
	});
});

app.post("/posts/:slug/publish", async (c) => {
	return handleRoute(c, async () => {
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.websitePostPublish(c.req.param("slug"));
	});
});

app.post("/posts/:slug/unpublish", async (c) => {
	return handleRoute(c, async () => {
		const { service } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		return await service.websitePostUnpublish(c.req.param("slug"));
	});
});

app.get("/health", async (c) => {
	return handleRoute(c, async () => {
		const { service, accountId } = await resolveWebsiteService(c.env, c.req.query("accountId"), parseWebsiteSource(c.req.query("source")));
		const info = await service.info();
		return {
			accountId,
			info,
		};
	});
});

app.post("/credential-preview", async (c) => {
	const payload = await c.req.json<Partial<WebsiteCredential>>();
	return c.json(jsonSuccess({
		baseUrl: payload.baseUrl?.trim() || "http://localhost:4321",
		author: payload.author?.trim() || "ErpanOmer",
		hasAdminToken: Boolean(payload.adminToken?.trim()),
	}));
});

export default app;
