import type { AIProvider, Env } from "../types";
import summaryPrompt from "../prompts/summary.prompt.txt?raw";
import tagsPrompt from "../prompts/tags.prompt.txt?raw";
import coverPrompt from "../prompts/cover.prompt.txt?raw";

const DEFAULT_MODEL = "qwen2:7b";

export class OllamaProvider implements AIProvider {
	constructor(private env: Env) {}

	private get baseUrl() {
		return (this.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
	}

	private getModel(fallback?: string) {
		return this.env.OLLAMA_MODEL ?? fallback ?? DEFAULT_MODEL;
	}

	private async callModel(systemPrompt: string, userPrompt: string, model?: string) {
		const body = {
			model: this.getModel(model),
            system: systemPrompt,
			prompt: userPrompt,
			stream: false,
			options: {
				temperature: 0.6,
				top_p: 0.9,
				num_ctx: 8192,
				repeat_penalty: 1.1,
			},
		};
		const response = await fetch(`${this.baseUrl}/api/generate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(this.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${this.env.OLLAMA_API_KEY}` } : {}),
			},
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			console.error("Ollama 请求失败", response.status, await response.text());
			return "";
		}
		const data = (await response.json()) as { response?: string };
		return data.response?.trim() ?? "";
	}

	private async callModelStream(systemPrompt: string, userPrompt: string, model?: string) {
		const body = {
			model,
            system: systemPrompt,
			prompt: userPrompt,
			stream: true,
			options: {
				temperature: 0.7,
				top_p: 0.9,
				num_ctx: 32768,
				repeat_penalty: 1.1,
			},
		};
		const response = await fetch(`${this.baseUrl}/api/generate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(this.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${this.env.OLLAMA_API_KEY}` } : {}),
			},
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			console.error("Ollama 流式请求失败", response.status, await response.text());
			return null;
		}
		return response.body;
	}

	async generateTitleText(systemPrompt: string, userPrompt: string) {
		return this.callModel(systemPrompt, userPrompt, "gemma3:12b-cloud");
	}

	async generateMarkdownContent(systemPrompt: string, userPrompt: string) {
		console.log("[OllamaProvider] 开始生成 Markdown 内容");
		const stream = await this.callModelStream(systemPrompt, userPrompt, "deepseek-v3.1:671b-cloud");
		if (!stream) {
			console.error("[OllamaProvider] 流式请求失败");
			return "";
		}
		
		let fullContent = "";
		let buffer = "";
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;
				
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				
				for (const line of lines) {
					if (!line.trim()) continue;
					
					try {
						const json = JSON.parse(line);
						if (json.response) {
							fullContent += json.response;
						}
					} catch (parseError) {
						console.warn("[OllamaProvider] JSON 解析失败:", line.substring(0, 100), parseError);
					}
				}
			}
			console.log("[OllamaProvider] Markdown 内容生成完成，总字符数:", fullContent.length);
		} finally {
			reader.releaseLock();
		}
		
		return fullContent;
	}

	async generateSummary(systemPrompt: string, userPrompt: string) {
		return this.callModel(systemPrompt, userPrompt, "qwen2:7b");
	}

	async generateTags(systemPrompt: string, userPrompt: string) {
		return this.callModel(systemPrompt, userPrompt, "qwen2:7b");
	}

	async generateImage(systemPrompt: string, userPrompt: string) {
		return this.callModel(systemPrompt, userPrompt, "qwen2:7b");
	}
}

export function createAIProvider(env: Env): AIProvider {
	return new OllamaProvider(env);
}
