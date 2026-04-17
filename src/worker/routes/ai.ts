import { Hono } from "hono";
import type { Env, PromptKey, AIModelSettings } from "@/worker/types";
import { listPromptTemplates, setPromptTemplate } from "@/worker/services/prompts";
import {
	getAIModelSettings,
	listAvailableAIModels,
	setAIModelSettings,
} from "@/worker/services/ai-settings";

const app = new Hono<{ Bindings: Env }>();

// Check AI provider status
app.get("/status", async (c) => {
	try {
		const baseUrl = c.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
		const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/version`);
		const settings = await getAIModelSettings(c.env);

		return c.json({
			provider: "ollama",
			ready: response.ok,
			lastCheckedAt: Date.now(),
			message: response.ok ? "Ollama service is online" : "Ollama service returned error",
			defaultModel: settings.defaultModel,
		});
	} catch (error) {
		const settings = await getAIModelSettings(c.env);
		return c.json({
			provider: "ollama",
			ready: false,
			lastCheckedAt: Date.now(),
			message: error instanceof Error ? error.message : "Failed to connect to AI provider",
			defaultModel: settings.defaultModel,
		});
	}
});

app.get("/models", async (c) => {
	const catalog = await listAvailableAIModels(c.env);
	return c.json(catalog);
});

app.get("/settings", async (c) => {
	const settings = await getAIModelSettings(c.env);
	return c.json(settings);
});

app.put("/settings", async (c) => {
	const payload = (await c.req.json()) as Partial<AIModelSettings>;
	const settings = await setAIModelSettings(c.env, payload);
	return c.json(settings);
});

// Prompts management
app.get("/prompts", async (c) => {
	const prompts = await listPromptTemplates(c.env);
	return c.json(prompts);
});

app.put("/prompts/:key", async (c) => {
	const key = c.req.param("key") as PromptKey;
	const { template } = await c.req.json() as { template: string };

	if (!template) {
		return c.json({ message: "template required" }, 400);
	}

	const result = await setPromptTemplate(c.env, key, template);
	return c.json(result);
});

export default app;
