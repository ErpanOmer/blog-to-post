import type { AIProvider, Env, AIGenerationOverrides } from "@/worker/types";
import {
	getAIModelSettings,
	type AIModelSettings,
} from "@/worker/services/ai-settings";

interface CallModelOptions {
	systemPrompt?: string;
	userPrompt?: string;
	model?: string;
	options?: Record<string, unknown>;
	requestTimeoutSec?: number;
	think?: string | boolean;
	stream?: boolean;
	[mkey: string]: unknown;
}

const FALLBACK_MODEL = "kimi-k2.5:cloud";

export class OllamaProvider implements AIProvider {
	private settingsCache: { value: AIModelSettings; loadedAt: number } | null = null;
	private readonly settingsTtlMs = 10_000;

	constructor(private env: Env) {
	}

	private get baseUrl() {
		return (this.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
	}

	private async getSettings(forceRefresh = false): Promise<AIModelSettings> {
		if (!forceRefresh && this.settingsCache && Date.now() - this.settingsCache.loadedAt < this.settingsTtlMs) {
			return this.settingsCache.value;
		}

		const settings = await getAIModelSettings(this.env);
		this.settingsCache = {
			value: settings,
			loadedAt: Date.now(),
		};
		return settings;
	}

	private async resolveModel(override?: string): Promise<string> {
		if (typeof override === "string" && override.trim()) {
			return override.trim();
		}

		const settings = await this.getSettings();
		return settings.defaultModel || this.env.OLLAMA_MODEL || FALLBACK_MODEL;
	}

	private async fetchWithTimeout(
		url: string,
		options: RequestInit,
		timeoutMs: number,
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

	async callModel(opts: CallModelOptions): Promise<string> {
		const MAX_RETRIES = 3;
		const BASE_DELAY_MS = 1000;
		const settings = await this.getSettings();

		const {
			systemPrompt,
			userPrompt,
			model,
			options,
			requestTimeoutSec,
			think,
			stream,
			...rest
		} = opts;

		const timeoutMs = Math.max(
			10,
			typeof requestTimeoutSec === "number"
				? requestTimeoutSec
				: settings.requestTimeoutSec,
		) * 1000;

		const requestModel =
			(typeof model === "string" && model.trim())
				? model.trim()
				: settings.defaultModel || this.env.OLLAMA_MODEL || FALLBACK_MODEL;

		const mergedOptions: Record<string, unknown> = {
			temperature: settings.temperature,
			top_p: settings.topP,
			num_predict: settings.maxTokens,
			...(options ?? {}),
		};

		const body: Record<string, unknown> = {
			...rest,
			model: requestModel,
			system: systemPrompt || "",
			prompt: userPrompt || "",
			stream: stream ?? false,
			think: think ?? false,
			options: mergedOptions,
		};

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(
					`${this.baseUrl}/api/generate`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...(this.env.OLLAMA_API_KEY
								? { Authorization: `Bearer ${this.env.OLLAMA_API_KEY}` }
								: {}),
						},
						body: JSON.stringify(body),
					},
					timeoutMs,
				);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(
						`Ollama request failed (attempt ${attempt}/${MAX_RETRIES})`,
						response.status,
						errorText,
					);

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
					`AI call failed (attempt ${attempt}/${MAX_RETRIES}):`,
					isAbortError ? "request timeout" : lastError.message,
				);

				if (attempt < MAX_RETRIES) {
					const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		console.error("AI call failed after max retries:", lastError?.message);
		return "";
	}

	async generateTitleText(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			format: "json",
			model: await this.resolveModel(model),
			options: {
				temperature: 0.55,
				top_p: 0.85,
				top_k: 40,
				num_predict: 200,
				num_ctx: 8192,
			},
		});
	}

	async generateMarkdownContent(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: await this.resolveModel(model),
			think: true,
			options: {
				temperature: 0.7,
				num_ctx: 32768,
				top_p: 0.9,
				repeat_penalty: 1.1,
			},
		});
	}

	async generateSummary(
		systemPrompt: string,
		userPrompt: string,
		overrides: AIGenerationOverrides = {},
	) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: await this.resolveModel(overrides.model),
			requestTimeoutSec: overrides.requestTimeoutSec,
			think: overrides.think ?? false,
			...(overrides.format ? { format: overrides.format } : {}),
			options: {
				temperature: overrides.temperature ?? 0.2,
				top_p: overrides.topP ?? 0.9,
				num_predict: overrides.maxTokens ?? 256,
				num_ctx: overrides.numCtx ?? 16384,
				...(overrides.extraOptions ?? {}),
			},
		});
	}

	async generateTags(
		systemPrompt: string,
		userPrompt: string,
		overrides: AIGenerationOverrides = {},
	) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: await this.resolveModel(overrides.model),
			requestTimeoutSec: overrides.requestTimeoutSec,
			think: overrides.think ?? false,
			...(overrides.format ? { format: overrides.format } : {}),
			options: {
				temperature: overrides.temperature ?? 0.35,
				top_p: overrides.topP ?? 0.85,
				num_predict: overrides.maxTokens ?? 256,
				num_ctx: overrides.numCtx ?? 16384,
				...(overrides.extraOptions ?? {}),
			},
		});
	}

	async generateImage(systemPrompt: string, userPrompt: string, model?: string) {
		return this.callModel({
			systemPrompt,
			userPrompt,
			model: await this.resolveModel(model),
			options: {
				temperature: 0.6,
				num_ctx: 4096,
			},
		});
	}
}

export const createAIProvider = function (env: Env): AIProvider {
	return new OllamaProvider(env);
};
