import type { AIProvider, Env } from "@/worker/types";

const models = {
	kimi: "kimi-k2.5:cloud",
	qwen: "qwen3-next:80b-cloud",
	deepseek: "deepseek-v3.2:cloud",
	default: 'qwen3:0.6b',
}

const DEFAULT_MODELS = {
	title: models.kimi,
	content: models.kimi,
	summary: models.qwen,
	tags: models.qwen,
	cover: models.qwen
};

// callModel 参数类型
interface CallModelOptions {
	systemPrompt?: string;
	userPrompt?: string;
	model?: string;
	options?: object;
	think?: string | boolean;
	stream?: boolean;
	[mkey: string]: unknown;
}

export class OllamaProvider implements AIProvider {
	constructor(private env: Env) {
	}

	private get baseUrl() {
		return (this.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
	}

	private getModel(type: keyof typeof DEFAULT_MODELS, override?: string) {
		if (override) return override;
		// 优先使用环境变量中指定的具体模型，例如 OLLAMA_CONTENT_MODEL
		const envKey = `OLLAMA_${type.toUpperCase()}_MODEL` as keyof Env;
		return (this.env[envKey] as string) ?? this.env.OLLAMA_MODEL ?? DEFAULT_MODELS[type];
	}

	/**
	 * 带超时和重试的 fetch 封装
	 */
	private async fetchWithTimeout(
		url: string,
		options: RequestInit,
		timeoutMs: number
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			});
			return response;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * 通用模型调用方法（带超时和重试机制）
	 * @param opts 包含所有参数的对象
	 */
	async callModel(opts: CallModelOptions): Promise<string> {
		const MAX_RETRIES = 3;
		const TIMEOUT_MS = 120_000; // 120 秒超时
		const BASE_DELAY_MS = 1000;

		// 构建请求体
		const body = {
			model: opts.model || models.default,
			system: opts.systemPrompt || "",
			prompt: opts.userPrompt || "",
			stream: opts.stream || false,
			think: opts.think || false,
			...opts
		};

		if (this.env.ENVIRONMENT === "development") {
			body.model = models.default;
		}

		console.log("请求模型:", body.model);

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(
					`${this.baseUrl}/api/generate`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...(this.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${this.env.OLLAMA_API_KEY}` } : {}),
						},
						body: JSON.stringify(body),
					},
					TIMEOUT_MS
				);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Ollama 请求失败 (尝试 ${attempt}/${MAX_RETRIES})`, response.status, errorText);

					// 4xx 错误不重试（客户端错误）
					if (response.status >= 400 && response.status < 500) {
						return "";
					}

					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = (await response.json()) as { response?: string };
				return data.response?.trim() ?? "";

			} catch (error) {
				lastError = error as Error;
				const isAbortError = lastError.name === "AbortError";

				console.warn(
					`AI 调用失败 (尝试 ${attempt}/${MAX_RETRIES}):`,
					isAbortError ? "请求超时" : lastError.message
				);

				if (attempt < MAX_RETRIES) {
					// 指数退避 + 随机抖动
					const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
					console.log(`等待 ${Math.round(delay)}ms 后重试...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		console.error("AI 调用最终失败，所有重试已耗尽:", lastError?.message);
		return "";
	}

	async generateTitleText(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			format: "json",
			model: this.getModel("title", model),
			options: { temperature: 0.55, top_p: 0.85, top_k: 40, num_predict: 200, num_ctx: 8192 },
		});
	}

	async generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: this.getModel("content", model),
			think: true,
			options: { temperature: 0.7, num_ctx: 32768, top_p: 0.9, repeat_penalty: 1.1 },
		});
	}

	async generateSummary(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: this.getModel("summary", model),
			format: "json",
			think: 'low',
			options: { temperature: 0.1, num_ctx: 16384 },
		});
	}

	async generateImage(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: this.getModel("cover", model),
			options: { temperature: 0.6, num_ctx: 4096 },
		});
	}
}

export const createAIProvider = function (env: Env): AIProvider {

	return new OllamaProvider(env);
}