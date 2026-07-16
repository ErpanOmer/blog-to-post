import { Hono } from "hono";
import type {
	AIModelRouteInput,
	AIModelSettings,
	CreateAIProviderProfileInput,
	PromptKey,
	UpdateAIProviderProfileInput,
} from "@/shared/types";
import type { Env } from "@/worker/types";
import { listPromptTemplates, setPromptTemplate } from "@/worker/services/prompts";
import {
	createProviderProfile,
	getProviderProfileWithSecret,
	getRoutingConfig,
	listProviderProfiles,
	removeProviderProfile,
	setRoutingConfig,
	updateProviderProfile,
} from "@/worker/services/ai-provider-settings";
import {
	candidateProfileWithSecret,
	listModelsForProvider,
	testAIProviderProfile,
} from "@/worker/ai/providers";
import { updateAIProviderVerification } from "@/worker/db/ai-providers";
import { AIServiceError, sanitizeAIErrorMessage } from "@/worker/services/ai-errors";

const app = new Hono<{ Bindings: Env }>();

app.get("/status", async (c) => {
	const routing = await getRoutingConfig(c.env);
	const route = routing.defaultRoute;
	if (!route) {
		return c.json({
			provider: "unconfigured",
			ready: false,
			lastCheckedAt: Date.now(),
			message: "尚未配置全局默认 AI 路由",
		});
	}
	const profiles = await listProviderProfiles(c.env);
	const profile = profiles.find((item) => item.id === route.providerId);
	return c.json({
		provider: route.protocol ?? profile?.protocol ?? "unknown",
		providerId: route.providerId,
		profileName: route.providerName ?? profile?.name,
		protocol: route.protocol ?? profile?.protocol,
		model: route.model,
		defaultModel: route.model,
		ready: Boolean(profile?.enabled) && profile?.lastVerificationStatus !== "failed",
		lastCheckedAt: Date.now(),
		message: profile?.lastVerificationStatus === "success"
			? "默认 AI 路由已配置且最近连接测试成功"
			: "默认 AI 路由已配置，建议执行连接测试",
	});
});

app.get("/providers", async (c) => c.json(await listProviderProfiles(c.env)));

app.post("/providers/test", async (c) => {
	const input = await c.req.json<CreateAIProviderProfileInput>();
	const profile = candidateProfileWithSecret(c.env, input);
	return c.json(await testAIProviderProfile(profile));
});

app.post("/providers", async (c) => {
	const input = await c.req.json<CreateAIProviderProfileInput>();
	return c.json(await createProviderProfile(c.env, input), 201);
});

app.post("/providers/:id/test", async (c) => {
	const id = c.req.param("id");
	try {
		const profile = await getProviderProfileWithSecret(c.env, id);
		const result = await testAIProviderProfile(profile);
		await updateAIProviderVerification(c.env.DB, id, "success", result.message);
		return c.json(result);
	} catch (error) {
		const message = error instanceof AIServiceError
			? error.message
			: "连接测试失败，请检查服务地址、凭证和模型";
		await updateAIProviderVerification(c.env.DB, id, "failed", sanitizeAIErrorMessage(message)).catch(() => undefined);
		throw error;
	}
});

app.get("/providers/:id/models", async (c) => {
	const profile = await getProviderProfileWithSecret(c.env, c.req.param("id"));
	return c.json(await listModelsForProvider(profile));
});

app.put("/providers/:id", async (c) => {
	const input = await c.req.json<UpdateAIProviderProfileInput>();
	return c.json(await updateProviderProfile(c.env, c.req.param("id"), input));
});

app.delete("/providers/:id", async (c) => {
	await removeProviderProfile(c.env, c.req.param("id"));
	return c.json({ success: true });
});

app.get("/routing", async (c) => c.json(await getRoutingConfig(c.env)));

app.put("/routing", async (c) => {
	const payload = await c.req.json<{ routes: AIModelRouteInput[] }>();
	return c.json(await setRoutingConfig(c.env, payload.routes));
});

// Compatibility endpoints for clients that have not yet moved to routing config.
app.get("/settings", async (c) => {
	const route = (await getRoutingConfig(c.env)).defaultRoute;
	if (!route) {
		throw new AIServiceError("AI_PROVIDER_NOT_CONFIGURED", "尚未配置全局默认 AI 路由", 503);
	}
	const settings: AIModelSettings = {
		defaultModel: route.model,
		temperature: route.temperature ?? 0.7,
		topP: route.topP ?? 0.9,
		maxTokens: route.maxTokens ?? 4096,
		requestTimeoutSec: route.requestTimeoutSec ?? 120,
	};
	return c.json(settings);
});

app.put("/settings", async (c) => {
	const updates = await c.req.json<Partial<AIModelSettings>>();
	const config = await getRoutingConfig(c.env);
	if (!config.defaultRoute) {
		throw new AIServiceError("AI_PROVIDER_NOT_CONFIGURED", "请先在智能设置中保存全局 AI 配置", 503);
	}
	const current = config.defaultRoute;
	const routes: AIModelRouteInput[] = [{
		feature: "default",
		providerId: current.providerId,
		model: updates.defaultModel?.trim() || current.model,
		temperature: updates.temperature ?? current.temperature,
		topP: updates.topP ?? current.topP,
		maxTokens: updates.maxTokens ?? current.maxTokens,
		requestTimeoutSec: updates.requestTimeoutSec ?? current.requestTimeoutSec,
	}];
	for (const route of Object.values(config.featureRoutes)) {
		if (!route) continue;
		routes.push({
			feature: route.feature,
			providerId: route.providerId,
			model: route.model,
			temperature: route.temperature,
			topP: route.topP,
			maxTokens: route.maxTokens,
			requestTimeoutSec: route.requestTimeoutSec,
		});
	}
	const next = await setRoutingConfig(c.env, routes);
	return c.json(next.defaultRoute);
});

app.get("/models", async (c) => {
	const config = await getRoutingConfig(c.env);
	if (!config.defaultRoute) return c.json({ defaultModel: "", cloudModels: [], localModels: [], models: [] });
	const profile = await getProviderProfileWithSecret(c.env, config.defaultRoute.providerId);
	const result = await listModelsForProvider(profile);
	const models = [...new Set([config.defaultRoute.model, ...result.models])];
	return c.json({ defaultModel: config.defaultRoute.model, cloudModels: models, localModels: [], models });
});

app.get("/prompts", async (c) => c.json(await listPromptTemplates(c.env)));

app.put("/prompts/:key", async (c) => {
	const key = c.req.param("key") as PromptKey;
	const { template } = await c.req.json() as { template: string };
	if (!template) return c.json({ message: "template required" }, 400);
	return c.json(await setPromptTemplate(c.env, key, template));
});

export default app;
