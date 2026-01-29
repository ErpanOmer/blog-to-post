import type { AIProvider, Env, GenerateInput, PlatformType } from "../types";
import { getPromptTemplate } from "../services/prompts";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

function buildPrompt(template: string, input: GenerateInput) {
	return `${template}\n\n标题：${input.title}\n语气：${input.tone}\n长度：${input.length}\n大纲：${input.outline ?? "无"}`;
}

async function resolveTemplate(env: Env, platform: PlatformType) {
	const template = await getPromptTemplate(env, platform);
	return template ?? "请生成高质量技术文章，结构清晰、可直接发布。";
}

export class CloudflareAIProvider implements AIProvider {
	constructor(private env: Env) {}

	async generateArticle(input: GenerateInput) {
		const template = await resolveTemplate(this.env, input.platform);
		const prompt = buildPrompt(template, input);
		const result = (await this.env.AI.run(DEFAULT_MODEL as any, {
			messages: [
				{ role: "system", content: "你是资深技术写作者，输出可直接发布的正文。" },
				{ role: "user", content: prompt },
			],
		})) as { response?: string } | string;
		if (typeof result === "string") {
			return result;
		}
		return result.response ?? JSON.stringify(result);
	}
}

export class OllamaProvider implements AIProvider {
	constructor(private env: Env) {}

	async generateArticle(input: GenerateInput) {
		const template = await resolveTemplate(this.env, input.platform);
		const prompt = buildPrompt(template, input);
		const baseUrl = this.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
		const model = this.env.OLLAMA_MODEL ?? "qwen2.5:7b";
		const response = await fetch(new URL("/api/generate", baseUrl), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model, prompt, stream: false }),
		});
		if (!response.ok) {
			console.error("Ollama 请求失败", response.status);
			return "生成失败，请检查 Ollama 服务状态。";
		}
		const data = (await response.json()) as { response?: string };
		return data.response ?? "生成失败，请检查 Ollama 返回值。";
	}
}

export function createAIProvider(env: Env): AIProvider {
	if (env.AI_PROVIDER === "ollama") {
		return new OllamaProvider(env);
	}
	return new CloudflareAIProvider(env);
}
