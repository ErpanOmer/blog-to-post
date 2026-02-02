import { Hono } from "hono";
import type { Env, PromptKey } from "../types";
import { listPromptTemplates, setPromptTemplate } from "../services/prompts";

const app = new Hono<{ Bindings: Env }>();

// Check AI provider status
app.get("/status", async (c) => {
    // 简单的健康检查
    try {
        // 这里我们假设 Ollama 在本地或云端运行
        // 由于 Provider 接口没有暴露 checkHealth，我们暂时只返回配置状态
        // 实际上可以尝试 fetch Ollama 的 version 接口
        const baseUrl = c.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/version`);

        return c.json({
            provider: "ollama",
            ready: response.ok,
            lastCheckedAt: Date.now(),
            message: response.ok ? "Ollama service is online" : "Ollama service returned error",
        });
    } catch (error) {
        return c.json({
            provider: "ollama",
            ready: false,
            lastCheckedAt: Date.now(),
            message: error instanceof Error ? error.message : "Failed to connect to AI provider",
        });
    }
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
