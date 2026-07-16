import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";
import type {
	AIFeature,
	AIModelRoute,
	AIProviderModelsResult,
	AIProviderProtocol,
	AIProviderTestResult,
	CreateAIProviderProfileInput,
} from "@/shared/types";
import type { AIGenerationOverrides, AIProvider, Env } from "@/worker/types";
import {
	getProviderProfileWithSecret,
	getRoutingConfig,
	type AIProviderProfileWithSecret,
} from "@/worker/services/ai-provider-settings";
import { AIServiceError, sanitizeAIErrorMessage } from "@/worker/services/ai-errors";

interface ResolvedGenerationRoute {
	profile: AIProviderProfileWithSecret;
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
}

const FEATURE_DEFAULTS: Record<AIFeature, Omit<ResolvedGenerationRoute, "profile" | "model">> = {
	title: { temperature: 0.55, topP: 0.85, maxTokens: 200, requestTimeoutSec: 120 },
	content: { temperature: 0.7, topP: 0.9, maxTokens: 4096, requestTimeoutSec: 180 },
	summary: { temperature: 0.2, topP: 0.9, maxTokens: 256, requestTimeoutSec: 120 },
	tags: { temperature: 0.35, topP: 0.85, maxTokens: 256, requestTimeoutSec: 120 },
	cover: { temperature: 0.6, topP: 0.9, maxTokens: 128, requestTimeoutSec: 60 },
	website_slug: { temperature: 0.2, topP: 0.9, maxTokens: 128, requestTimeoutSec: 60 },
};

function mergeRouteParameters(
	feature: AIFeature,
	defaultRoute: AIModelRoute,
	featureRoute?: AIModelRoute,
): Omit<ResolvedGenerationRoute, "profile" | "model"> {
	const safe = FEATURE_DEFAULTS[feature];
	return {
		temperature: featureRoute?.temperature ?? defaultRoute.temperature ?? safe.temperature,
		topP: featureRoute?.topP ?? defaultRoute.topP ?? safe.topP,
		maxTokens: featureRoute?.maxTokens ?? defaultRoute.maxTokens ?? safe.maxTokens,
		requestTimeoutSec: featureRoute?.requestTimeoutSec ?? defaultRoute.requestTimeoutSec ?? safe.requestTimeoutSec,
	};
}

function createLanguageModel(profile: AIProviderProfileWithSecret, modelId: string): LanguageModel {
	if (profile.protocol === "anthropic") {
		const provider = createAnthropic({
			baseURL: profile.baseUrl,
			...(profile.apiKey ? { apiKey: profile.apiKey } : {}),
		});
		return provider(modelId);
	}
	const provider = createOpenAICompatible({
		name: "openai-compatible",
		baseURL: profile.baseUrl,
		...(profile.apiKey ? { apiKey: profile.apiKey } : {}),
	});
	return provider(modelId);
}

function isDeepSeekEndpoint(baseUrl: string): boolean {
	try {
		const hostname = new URL(baseUrl).hostname.toLowerCase();
		return hostname === "deepseek.com" || hostname.endsWith(".deepseek.com");
	} catch {
		return false;
	}
}

function getStatusCode(error: unknown): number | undefined {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
		const candidate = current as { statusCode?: unknown; status?: unknown; lastError?: unknown; cause?: unknown };
		if (typeof candidate.statusCode === "number") return candidate.statusCode;
		if (typeof candidate.status === "number") return candidate.status;
		current = candidate.lastError ?? candidate.cause;
	}
	return undefined;
}

function hasTimeoutSignal(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (current instanceof Error && (current.name === "AbortError" || /timeout|timed out/i.test(current.message))) {
			return true;
		}
		if (typeof current !== "object") return false;
		const candidate = current as { lastError?: unknown; cause?: unknown };
		current = candidate.lastError ?? candidate.cause;
	}
	return false;
}

function toAIServiceError(error: unknown): AIServiceError {
	if (error instanceof AIServiceError) return error;
	const statusCode = getStatusCode(error);
	if (statusCode === 401 || statusCode === 403) {
		return new AIServiceError("AI_AUTH_FAILED", "AI 服务鉴权失败，请检查 API Key", 401);
	}
	if (statusCode === 404) {
		return new AIServiceError("AI_MODEL_NOT_FOUND", "AI 模型或接口路径不存在，请检查 Base URL 和模型 ID", 404);
	}
	if (statusCode === 429) {
		return new AIServiceError("AI_RATE_LIMITED", "AI 服务请求过于频繁，请稍后重试", 429);
	}
	if (hasTimeoutSignal(error)) {
		return new AIServiceError("AI_TIMEOUT", "AI 服务响应超时，请重试或调整超时时间", 504);
	}
	if (statusCode && statusCode >= 500) {
		return new AIServiceError("AI_PROVIDER_UNAVAILABLE", "AI 服务暂时不可用，请稍后重试", 502);
	}
	return new AIServiceError("AI_PROVIDER_UNAVAILABLE", "AI 服务请求失败，请检查服务地址与模型配置", 502);
}

async function runGeneration(
	profile: AIProviderProfileWithSecret,
	modelId: string,
	options: {
		systemPrompt: string;
		userPrompt: string;
		temperature: number;
		topP: number;
		maxTokens: number;
		requestTimeoutSec: number;
		acceptReasoningOnly?: boolean;
	},
): Promise<string> {
	try {
		const result = await generateText({
			model: createLanguageModel(profile, modelId),
			system: options.systemPrompt,
			prompt: options.userPrompt,
			temperature: options.temperature,
			topP: options.topP,
			maxOutputTokens: options.maxTokens,
			maxRetries: 2,
			timeout: { totalMs: options.requestTimeoutSec * 1000 },
			providerOptions: profile.protocol === "anthropic"
				? { anthropic: { thinking: { type: "disabled" } } }
				: isDeepSeekEndpoint(profile.baseUrl)
					? { openaiCompatible: { thinking: { type: "disabled" } } }
					: undefined,
		});
		const text = result.text.trim();
		if (!text && options.acceptReasoningOnly && result.reasoningText?.trim()) {
			return "OK";
		}
		if (!text) {
			const reason = result.finishReason === "length"
				? "AI 输出额度在最终文本前已耗尽，请提高 max tokens 或关闭思考模式"
				: "AI 服务返回了空内容";
			throw new AIServiceError("AI_INVALID_RESPONSE", reason, 502);
		}
		return text;
	} catch (error) {
		const mapped = toAIServiceError(error);
		console.warn(`[ai] ${mapped.code}: ${sanitizeAIErrorMessage(mapped.message)}`);
		throw mapped;
	}
}

export async function testAIProviderProfile(
	profile: AIProviderProfileWithSecret,
): Promise<AIProviderTestResult> {
	await runGeneration(profile, profile.defaultModel, {
		systemPrompt: "You are a connection health check.",
		userPrompt: "Reply with OK only.",
		temperature: 0,
		topP: 1,
		maxTokens: 512,
		requestTimeoutSec: 30,
		acceptReasoningOnly: true,
	});
	return {
		success: true,
		message: `连接成功：${profile.name} / ${profile.defaultModel} 已正常返回响应`,
		provider: {
			name: profile.name,
			protocol: profile.protocol,
			model: profile.defaultModel,
		},
		testedAt: Date.now(),
	};
}

export function candidateProfileWithSecret(
	env: Env,
	input: CreateAIProviderProfileInput,
): AIProviderProfileWithSecret {
	const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
	let parsed: URL;
	try {
		parsed = new URL(baseUrl);
	} catch {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "Base URL 格式无效", 400);
	}
	if (parsed.protocol !== "https:") {
		const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
		if (env.ENVIRONMENT !== "development" || parsed.protocol !== "http:" || !local) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "生产环境只允许 HTTPS；本地开发仅允许 localhost HTTP", 400);
		}
	}
	if (input.protocol !== "openai-compatible" && input.protocol !== "anthropic") {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "不支持的 AI 协议类型", 400);
	}
	if (!input.defaultModel?.trim()) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "默认模型不能为空", 400);
	}
	const now = Date.now();
	return {
		id: "unsaved",
		name: input.name?.trim() || "Unsaved provider",
		protocol: input.protocol,
		baseUrl,
		apiKeyCiphertext: null,
		apiKey: input.apiKey?.trim() || null,
		defaultModel: input.defaultModel.trim(),
		enabled: 1,
		lastVerifiedAt: null,
		lastVerificationStatus: null,
		lastVerificationMessage: null,
		createdAt: now,
		updatedAt: now,
	};
}

export async function listModelsForProvider(
	profile: AIProviderProfileWithSecret,
): Promise<AIProviderModelsResult> {
	const url = `${profile.baseUrl.replace(/\/$/, "")}/models`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15_000);
	try {
		const response = await fetch(url, {
			headers: profile.protocol === "anthropic"
				? {
					...(profile.apiKey ? { "x-api-key": profile.apiKey } : {}),
					"anthropic-version": "2023-06-01",
				}
				: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {},
			signal: controller.signal,
		});
		if (response.status === 401 || response.status === 403) {
			throw new AIServiceError("AI_AUTH_FAILED", "模型目录鉴权失败，请检查 API Key", 401);
		}
		if (!response.ok) {
			return { supported: false, models: [], message: "该服务未提供可读取的模型目录，请手动输入模型 ID" };
		}
		const payload = await response.json() as { data?: Array<{ id?: string }>; models?: Array<{ id?: string; name?: string }> };
		const models = [...new Set([
			...(payload.data ?? []).map((item) => item.id ?? ""),
			...(payload.models ?? []).map((item) => item.id ?? item.name ?? ""),
		].map((item) => item.trim()).filter(Boolean))];
		if (!models.length) {
			return { supported: false, models: [], message: "模型目录响应格式不受支持，请手动输入模型 ID" };
		}
		return { supported: true, models, message: `已读取 ${models.length} 个模型` };
	} catch (error) {
		if (error instanceof AIServiceError) throw error;
		if (error instanceof Error && error.name === "AbortError") {
			return { supported: false, models: [], message: "读取模型目录超时，请手动输入模型 ID" };
		}
		return { supported: false, models: [], message: "无法读取模型目录，请手动输入模型 ID" };
	} finally {
		clearTimeout(timer);
	}
}

export class AIProviderService implements AIProvider {
	constructor(private readonly env: Env) {}

	private async resolveRoute(feature: AIFeature): Promise<ResolvedGenerationRoute> {
		const routing = await getRoutingConfig(this.env);
		if (!routing.defaultRoute) {
			throw new AIServiceError("AI_PROVIDER_NOT_CONFIGURED", "尚未配置全局默认 AI 服务和模型", 503);
		}
		const selectedRoute = routing.defaultRoute;
		const profile = await getProviderProfileWithSecret(this.env, selectedRoute.providerId);
		if (!profile.enabled) {
			throw new AIServiceError("AI_PROVIDER_NOT_CONFIGURED", "当前全局 AI 配置已停用", 503);
		}
		return {
			profile,
			model: selectedRoute.model || profile.defaultModel,
			...mergeRouteParameters(feature, routing.defaultRoute),
		};
	}

	private async generate(
		feature: AIFeature,
		systemPrompt: string,
		userPrompt: string,
		overrides: AIGenerationOverrides = {},
	): Promise<string> {
		const route = await this.resolveRoute(feature);
		return runGeneration(route.profile, route.model, {
			systemPrompt,
			userPrompt,
			...route,
			temperature: overrides.temperature ?? route.temperature,
			topP: overrides.topP ?? route.topP,
		});
	}

	generateTitleText(systemPrompt: string, userPrompt: string): Promise<string> {
		return this.generate("title", systemPrompt, userPrompt);
	}

	generateMarkdownContent(systemPrompt: string, userPrompt: string): Promise<string> {
		return this.generate("content", systemPrompt, userPrompt);
	}

	generateSummary(systemPrompt: string, userPrompt: string, overrides?: AIGenerationOverrides): Promise<string> {
		return this.generate("summary", systemPrompt, userPrompt, overrides);
	}

	generateTags(systemPrompt: string, userPrompt: string, overrides?: AIGenerationOverrides): Promise<string> {
		return this.generate("tags", systemPrompt, userPrompt, overrides);
	}

	generateImage(systemPrompt: string, userPrompt: string): Promise<string> {
		return this.generate("cover", systemPrompt, userPrompt);
	}

	generateWebsiteSlug(systemPrompt: string, userPrompt: string): Promise<string> {
		return this.generate("website_slug", systemPrompt, userPrompt);
	}
}

export function createAIProvider(env: Env): AIProviderService {
	return new AIProviderService(env);
}

export type { AIProviderProtocol };
