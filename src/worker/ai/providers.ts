import type { AIProvider, Env } from "../types";

const DEFAULT_MODELS = {
	title: "deepseek-v3.2:cloud",
	content: "kimi-k2.5:cloud",
	summary: "qwen3-next:80b-cloud",
	tags: "qwen3-next:80b-cloud",
	cover: "qwen3-next:80b-cloud",
};

// Ollama 请求体选项类型
interface OllamaOptions {
	temperature?: number;
	top_p?: number;
	num_ctx?: number;
	repeat_penalty?: number;
	seed?: number;
	num_predict?: number;
	stop?: string[];
	[mkey: string]: unknown;
}

// callModel 参数类型
interface CallModelOptions {
	systemPrompt: string;
	userPrompt: string;
	model: string;
	options?: Partial<OllamaOptions>;
	think?: string | boolean;
	stream?: boolean;
	[mkey: string]: unknown;
}

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

	/**
	 * 通用模型调用方法
	 * @param opts 包含所有参数的对象
	 */
	async callModel(opts: CallModelOptions): Promise<string> {
		const {
			systemPrompt,
			userPrompt,
			model,
			options: customOptions = {},
			think = false,
			stream = false,
			...restBody
		} = opts;

		// 默认选项
		const defaultOptions: OllamaOptions = {
			temperature: 0.6,
			top_p: 0.9,
			num_ctx: 8192,
			repeat_penalty: 1.1,
		};

		// 合并选项：customOptions 覆盖默认值
		const options: OllamaOptions = {
			...defaultOptions,
			...customOptions,
		};

		// 构建请求体
		const body = {
			model,
			system: systemPrompt,
			prompt: userPrompt,
			stream,
			think,
			options,
			...restBody,
		};

		console.log("Ollama 请求体:", body);

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

	async generateTitleText(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			format: "json",
			model: this.getModel("title", model),
			options: { temperature: 0.55, top_p: 0.85, top_k: 40, num_predict: 200, num_ctx: 16384 },
		});
	}

	async generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: this.getModel("content", model),
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

	async generateTags(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: this.getModel("tags", model),
			options: { temperature: 0.4, num_ctx: 4096 },
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