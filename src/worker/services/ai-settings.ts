import type { Env } from "@/worker/types";

const AI_SETTINGS_KV_KEY = "ai:model-settings";

const CLOUD_MODEL_CANDIDATES = [
	"kimi-k2.5:cloud",
	"qwen3-next:80b-cloud",
	"deepseek-v3.2:cloud",
];

export interface AIModelSettings {
	defaultModel: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
}

export interface AIModelCatalog {
	defaultModel: string;
	cloudModels: string[];
	localModels: string[];
	models: string[];
}

const DEFAULT_AI_MODEL_SETTINGS: AIModelSettings = {
	defaultModel: "kimi-k2.5:cloud",
	temperature: 0.7,
	topP: 0.9,
	maxTokens: 4096,
	requestTimeoutSec: 120,
};

function normalizeModel(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim();
	return trimmed || fallback;
}

function normalizeNumber(
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function normalizeAIModelSettings(
	input?: Partial<AIModelSettings> | null,
): AIModelSettings {
	const base = {
		...DEFAULT_AI_MODEL_SETTINGS,
		...(input ?? {}),
	};

	return {
		defaultModel: normalizeModel(
			base.defaultModel,
			DEFAULT_AI_MODEL_SETTINGS.defaultModel,
		),
		temperature: normalizeNumber(
			base.temperature,
			DEFAULT_AI_MODEL_SETTINGS.temperature,
			0,
			2,
		),
		topP: normalizeNumber(base.topP, DEFAULT_AI_MODEL_SETTINGS.topP, 0, 1),
		maxTokens: normalizeNumber(
			base.maxTokens,
			DEFAULT_AI_MODEL_SETTINGS.maxTokens,
			128,
			32768,
		),
		requestTimeoutSec: normalizeNumber(
			base.requestTimeoutSec,
			DEFAULT_AI_MODEL_SETTINGS.requestTimeoutSec,
			10,
			600,
		),
	};
}

export async function getAIModelSettings(env: Env): Promise<AIModelSettings> {
	const raw = await env.PROMPTS.get(AI_SETTINGS_KV_KEY);
	if (!raw) return DEFAULT_AI_MODEL_SETTINGS;

	try {
		const parsed = JSON.parse(raw) as Partial<AIModelSettings>;
		return normalizeAIModelSettings(parsed);
	} catch {
		return DEFAULT_AI_MODEL_SETTINGS;
	}
}

export async function setAIModelSettings(
	env: Env,
	updates: Partial<AIModelSettings>,
): Promise<AIModelSettings> {
	const current = await getAIModelSettings(env);
	const next = normalizeAIModelSettings({ ...current, ...updates });
	await env.PROMPTS.put(AI_SETTINGS_KV_KEY, JSON.stringify(next));
	return next;
}

async function fetchLocalOllamaModels(env: Env): Promise<string[]> {
	const baseUrl = (env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(
		/\/$/,
		"",
	);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);

	try {
		const response = await fetch(`${baseUrl}/api/tags`, {
			headers: {
				...(env.OLLAMA_API_KEY
					? { Authorization: `Bearer ${env.OLLAMA_API_KEY}` }
					: {}),
			},
			signal: controller.signal,
		});
		if (!response.ok) return [];

		const payload = (await response.json()) as {
			models?: Array<{ name?: string; model?: string }>;
		};
		const names = (payload.models ?? [])
			.map((item) => item.name ?? item.model ?? "")
			.map((item) => item.trim())
			.filter(Boolean);
		return [...new Set(names)];
	} catch {
		return [];
	} finally {
		clearTimeout(timer);
	}
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const dedupeKey = value.toLowerCase();
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);
		result.push(value);
	}
	return result;
}

export async function listAvailableAIModels(env: Env): Promise<AIModelCatalog> {
	const settings = await getAIModelSettings(env);
	const localModels = uniqueStrings(await fetchLocalOllamaModels(env));
	const localSet = new Set(localModels);
	const cloudModels = uniqueStrings(CLOUD_MODEL_CANDIDATES).filter(
		(model) => !localSet.has(model),
	);
	const models = uniqueStrings([
		settings.defaultModel,
		...cloudModels,
		...localModels,
	]);

	return {
		defaultModel: settings.defaultModel,
		cloudModels,
		localModels,
		models,
	};
}
