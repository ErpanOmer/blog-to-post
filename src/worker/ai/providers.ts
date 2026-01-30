import type { AIProvider, Env } from "../types";

const DEFAULT_MODELS = {
	title: "gemma3:12b-cloud",
	content: "deepseek-v3.1:671b-cloud",
	summary: "qwen2:7b",
	tags: "qwen2:7b",
	cover: "qwen2:7b",
};

export class OllamaProvider implements AIProvider {
	constructor(private env: Env) { }

	private get baseUrl() {
		return (this.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
	}

	private getModel(type: keyof typeof DEFAULT_MODELS, override?: string) {
		if (override) return override;
		// 优先使用环境变量中指定的具体模型，例如 OLLAMA_CONTENT_MODEL
		const envKey = `OLLAMA_${type.toUpperCase()}_MODEL` as keyof Env;
		return (this.env[envKey] as string) ?? this.env.OLLAMA_MODEL ?? DEFAULT_MODELS[type];
	}

	private async callModel(systemPrompt: string, userPrompt: string, model: string) {
		const body = {
			model,
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

	private async callModelStream(systemPrompt: string, userPrompt: string, model: string) {
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

	/**
	 * 将 Ollama 的 NDJSON 流转换为纯文本流
	 */
	private processOllamaStream(rawStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
		const reader = rawStream.getReader();
		const decoder = new TextDecoder();
		const encoder = new TextEncoder();
		let buffer = "";

		return new ReadableStream({
			async pull(controller) {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						if (buffer.trim()) {
							// 处理剩余的可能不完整的行（虽然 Ollama 应该是完整的行）
						}
						controller.close();
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const json = JSON.parse(line);
							if (json.response) {
								controller.enqueue(encoder.encode(json.response));
							}
							if (json.done) {
								// 可以选择在这里 close，但通常等 done: true
							}
						} catch (e) {
							console.warn("Ollama stream line parse error:", e);
						}
					}

					if (lines.length > 0) {
						// 只要处理了行，就跳回 pull 循环外，让 fetch 继续拉取
						break;
					}
				}
			},
			cancel() {
				reader.cancel();
			},
		});
	}

	async generateTitleText(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel(systemPrompt, userPrompt, this.getModel("title", model));
	}

	async generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string) {
		const stream = await this.generateMarkdownStream(systemPrompt, userPrompt, model);
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let fullContent = "";
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			fullContent += decoder.decode(value);
		}
		return fullContent;
	}

	async generateMarkdownStream(systemPrompt: string, userPrompt: string, model?: string) {
		const rawStream = await this.callModelStream(systemPrompt, userPrompt, this.getModel("content", model));
		if (!rawStream) {
			throw new Error("Failed to start AI stream");
		}
		return this.processOllamaStream(rawStream);
	}

	async generateSummary(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel(systemPrompt, userPrompt, this.getModel("summary", model));
	}

	async generateTags(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel(systemPrompt, userPrompt, this.getModel("tags", model));
	}

	async generateImage(systemPrompt: string, userPrompt: string, model?: string) {
		// 目前 Ollama 主要用于 LLM，此处如果是生成图像 Prompt 或是集成 SD 需另作考虑
		// 暂时保持现状，但修正接口签名
		return this.callModel(systemPrompt, userPrompt, this.getModel("cover", model));
	}
}

export function createAIProvider(env: Env): AIProvider {
	return new OllamaProvider(env);
}
