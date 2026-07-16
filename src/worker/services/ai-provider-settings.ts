import type {
	AIModelRouteInput,
	AIModelRoutingConfig,
	AIProviderProfileSummary,
	CreateAIProviderProfileInput,
	UpdateAIProviderProfileInput,
} from "@/shared/types";
import {
	countRoutesUsingProvider,
	deleteAIProviderProfile,
	getAIModelRoutingConfig,
	getAIProviderProfileRecord,
	insertAIProviderProfile,
	listAIProviderProfiles,
	replaceAIModelRoutes,
	replaceAIProviderProfile,
	type AIProviderProfileRecord,
} from "@/worker/db/ai-providers";
import type { Env } from "@/worker/types";
import { decrypt, encrypt } from "@/worker/utils/crypto";
import { AIServiceError } from "@/worker/services/ai-errors";

const ROUTE_FEATURES = new Set(["default", "title", "content", "summary", "tags", "cover", "website_slug"]);

export interface AIProviderProfileWithSecret extends AIProviderProfileRecord {
	apiKey: string | null;
}

function requiredText(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", `${field} 不能为空`, 400);
	}
	return value.trim();
}

function normalizeBaseUrl(value: unknown, env: Env): string {
	const raw = requiredText(value, "Base URL").replace(/\/$/, "");
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "Base URL 格式无效", 400);
	}
	if (url.username || url.password) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "Base URL 不能包含用户名或密码", 400);
	}
	if (url.protocol !== "https:") {
		const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
		if (env.ENVIRONMENT !== "development" || !isLocal || url.protocol !== "http:") {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "生产环境只允许 HTTPS；本地开发仅允许 localhost HTTP", 400);
		}
	}
	return url.toString().replace(/\/$/, "");
}

function normalizeProtocol(value: unknown): "openai-compatible" | "anthropic" {
	if (value !== "openai-compatible" && value !== "anthropic") {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "不支持的 AI 协议类型", 400);
	}
	return value;
}

async function encryptApiKey(env: Env, apiKey: string | undefined): Promise<string | null> {
	const normalized = apiKey?.trim();
	if (!normalized) return null;
	if (!env.ENCRYPTION_KEY) {
		throw new AIServiceError(
			"AI_INVALID_CONFIGURATION",
			"保存 API Key 前必须配置 32 字节 ENCRYPTION_KEY",
			503,
		);
	}
	return encrypt(normalized, env.ENCRYPTION_KEY);
}

export async function listProviderProfiles(env: Env): Promise<AIProviderProfileSummary[]> {
	return listAIProviderProfiles(env.DB);
}

export async function getProviderProfileWithSecret(env: Env, id: string): Promise<AIProviderProfileWithSecret> {
	const record = await getAIProviderProfileRecord(env.DB, id);
	if (!record) throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 配置不存在", 404);
	let apiKey: string | null = null;
	if (record.apiKeyCiphertext) {
		if (!env.ENCRYPTION_KEY) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "ENCRYPTION_KEY 未配置，无法读取已保存凭证", 503);
		}
		apiKey = await decrypt(record.apiKeyCiphertext, env.ENCRYPTION_KEY);
	}
	return { ...record, apiKey };
}

export async function createProviderProfile(
	env: Env,
	input: CreateAIProviderProfileInput,
): Promise<AIProviderProfileSummary> {
	const now = Date.now();
	const record: AIProviderProfileRecord = {
		id: crypto.randomUUID(),
		name: requiredText(input.name, "AI 配置名称"),
		protocol: normalizeProtocol(input.protocol),
		baseUrl: normalizeBaseUrl(input.baseUrl, env),
		apiKeyCiphertext: await encryptApiKey(env, input.apiKey),
		defaultModel: requiredText(input.defaultModel, "默认模型"),
		enabled: input.enabled === false ? 0 : 1,
		lastVerifiedAt: null,
		lastVerificationStatus: null,
		lastVerificationMessage: null,
		createdAt: now,
		updatedAt: now,
	};
	try {
		return await insertAIProviderProfile(env.DB, record);
	} catch (error) {
		if (error instanceof Error && error.message.includes("UNIQUE")) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 配置名称已存在", 409);
		}
		throw error;
	}
}

export async function updateProviderProfile(
	env: Env,
	id: string,
	input: UpdateAIProviderProfileInput,
): Promise<AIProviderProfileSummary> {
	const current = await getAIProviderProfileRecord(env.DB, id);
	if (!current) throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 配置不存在", 404);

	let apiKeyCiphertext = current.apiKeyCiphertext;
	if (input.clearApiKey) apiKeyCiphertext = null;
	else if (input.apiKey?.trim()) apiKeyCiphertext = await encryptApiKey(env, input.apiKey);
	const connectionChanged = (
		input.protocol !== undefined
		|| input.baseUrl !== undefined
		|| input.defaultModel !== undefined
		|| Boolean(input.apiKey?.trim())
		|| Boolean(input.clearApiKey)
	);

	const next: AIProviderProfileRecord = {
		...current,
		name: input.name === undefined ? current.name : requiredText(input.name, "AI 配置名称"),
		protocol: input.protocol === undefined ? current.protocol : normalizeProtocol(input.protocol),
		baseUrl: input.baseUrl === undefined ? current.baseUrl : normalizeBaseUrl(input.baseUrl, env),
		apiKeyCiphertext,
		defaultModel: input.defaultModel === undefined ? current.defaultModel : requiredText(input.defaultModel, "默认模型"),
		enabled: input.enabled === undefined ? current.enabled : input.enabled ? 1 : 0,
		lastVerifiedAt: connectionChanged ? null : current.lastVerifiedAt,
		lastVerificationStatus: connectionChanged ? null : current.lastVerificationStatus,
		lastVerificationMessage: connectionChanged ? null : current.lastVerificationMessage,
		updatedAt: Date.now(),
	};
	try {
		return await replaceAIProviderProfile(env.DB, next);
	} catch (error) {
		if (error instanceof Error && error.message.includes("UNIQUE")) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 配置名称已存在", 409);
		}
		throw error;
	}
}

export async function removeProviderProfile(env: Env, id: string): Promise<void> {
	const current = await getAIProviderProfileRecord(env.DB, id);
	if (!current) throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 配置不存在", 404);
	if (await countRoutesUsingProvider(env.DB, id)) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "该 AI 配置仍在使用中，无法删除", 409);
	}
	await deleteAIProviderProfile(env.DB, id);
}

export async function getRoutingConfig(env: Env): Promise<AIModelRoutingConfig> {
	return getAIModelRoutingConfig(env.DB);
}

function normalizedOptionalNumber(
	value: number | null,
	field: string,
	min: number,
	max: number,
): number | null {
	if (value === null || value === undefined) return null;
	if (!Number.isFinite(value) || value < min || value > max) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", `${field} 必须在 ${min}–${max} 之间`, 400);
	}
	return value;
}

export async function setRoutingConfig(env: Env, routes: AIModelRouteInput[]): Promise<AIModelRoutingConfig> {
	if (!Array.isArray(routes) || !routes.some((route) => route.feature === "default")) {
		throw new AIServiceError("AI_INVALID_CONFIGURATION", "必须配置全局默认 AI 路由", 400);
	}
	const seen = new Set<string>();
	const normalized: AIModelRouteInput[] = [];
	for (const route of routes) {
		if (!ROUTE_FEATURES.has(route.feature) || seen.has(route.feature)) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "AI 路由功能重复或无效", 400);
		}
		seen.add(route.feature);
		const profile = await getAIProviderProfileRecord(env.DB, requiredText(route.providerId, "AI 配置"));
		if (!profile || !profile.enabled) {
			throw new AIServiceError("AI_INVALID_CONFIGURATION", "全局 AI 配置不存在或已停用", 400);
		}
		normalized.push({
			feature: route.feature,
			providerId: profile.id,
			model: requiredText(route.model || profile.defaultModel, "模型"),
			temperature: normalizedOptionalNumber(route.temperature, "temperature", 0, 2),
			topP: normalizedOptionalNumber(route.topP, "topP", 0, 1),
			maxTokens: normalizedOptionalNumber(route.maxTokens, "maxTokens", 1, 131072),
			requestTimeoutSec: normalizedOptionalNumber(route.requestTimeoutSec, "超时时间", 5, 600),
		});
	}
	await replaceAIModelRoutes(env.DB, normalized);
	return getAIModelRoutingConfig(env.DB);
}
