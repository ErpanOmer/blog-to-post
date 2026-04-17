import type { ArticleAISettings } from "@/react-app/types";

const STORAGE_KEY = "article-ai-settings:v2";
const LEGACY_STORAGE_KEY = "article-ai-settings:v1";

export type ArticleAIFeatureKey = "summary" | "tags" | "title" | "content" | "cover";

export interface ArticleAIFeatureSettings {
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
	prompt: string;
}

export interface ArticleAIWorkbenchSettings {
	summary: ArticleAIFeatureSettings;
	tags: ArticleAIFeatureSettings;
	title: ArticleAIFeatureSettings;
	content: ArticleAIFeatureSettings;
	cover: ArticleAIFeatureSettings;
}

type PartialArticleAIWorkbenchSettings = {
	[K in ArticleAIFeatureKey]?: Partial<ArticleAIFeatureSettings>;
};

const DEFAULT_BASE: Omit<ArticleAIFeatureSettings, "prompt"> = {
	model: "kimi-k2.5:cloud",
	temperature: 0.2,
	topP: 0.9,
	maxTokens: 512,
	requestTimeoutSec: 120,
};

const DEFAULT_ARTICLE_AI_SETTINGS: ArticleAIWorkbenchSettings = {
	summary: {
		...DEFAULT_BASE,
		prompt: "请基于文章内容生成简洁摘要。输出纯文本，不超过80个汉字。",
	},
	tags: {
		...DEFAULT_BASE,
		temperature: 0.35,
		topP: 0.85,
		prompt: "请基于文章内容生成3-8个技术标签。优先技术名词，标签尽量简短。输出JSON：{\"tags\":[\"标签1\",\"标签2\"]}",
	},
	title: {
		...DEFAULT_BASE,
		temperature: 0.55,
		topP: 0.85,
		prompt: "预留：文章标题生成 Prompt（暂未启用）",
	},
	content: {
		...DEFAULT_BASE,
		temperature: 0.7,
		topP: 0.9,
		maxTokens: 4096,
		prompt: "预留：文章正文生成 Prompt（暂未启用）",
	},
	cover: {
		...DEFAULT_BASE,
		temperature: 0.6,
		topP: 0.9,
		prompt: "预留：文章封面生成 Prompt（暂未启用）",
	},
};

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

function normalizeString(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim();
	return trimmed || fallback;
}

function normalizeFeatureSettings(
	input: Partial<ArticleAIFeatureSettings> | undefined,
	fallback: ArticleAIFeatureSettings,
): ArticleAIFeatureSettings {
	return {
		model: normalizeString(input?.model, fallback.model),
		temperature: normalizeNumber(input?.temperature, fallback.temperature, 0, 2),
		topP: normalizeNumber(input?.topP, fallback.topP, 0, 1),
		maxTokens: normalizeNumber(input?.maxTokens, fallback.maxTokens, 64, 32768),
		requestTimeoutSec: normalizeNumber(input?.requestTimeoutSec, fallback.requestTimeoutSec, 10, 600),
		prompt: normalizeString(input?.prompt, fallback.prompt),
	};
}

function normalizeSettings(input?: PartialArticleAIWorkbenchSettings | null): ArticleAIWorkbenchSettings {
	return {
		summary: normalizeFeatureSettings(input?.summary, DEFAULT_ARTICLE_AI_SETTINGS.summary),
		tags: normalizeFeatureSettings(input?.tags, DEFAULT_ARTICLE_AI_SETTINGS.tags),
		title: normalizeFeatureSettings(input?.title, DEFAULT_ARTICLE_AI_SETTINGS.title),
		content: normalizeFeatureSettings(input?.content, DEFAULT_ARTICLE_AI_SETTINGS.content),
		cover: normalizeFeatureSettings(input?.cover, DEFAULT_ARTICLE_AI_SETTINGS.cover),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function migrateLegacySettings(raw: unknown): ArticleAIWorkbenchSettings | null {
	if (!isRecord(raw)) return null;
	if (!("model" in raw)) return null;

	const legacy = raw as Partial<ArticleAISettings>;
	return normalizeSettings({
		summary: {
			model: legacy.model,
			temperature: legacy.temperature,
			topP: legacy.topP,
			maxTokens: legacy.maxTokens,
			requestTimeoutSec: legacy.requestTimeoutSec,
			prompt: legacy.summaryPrompt,
		},
		tags: {
			model: legacy.model,
			temperature: legacy.temperature,
			topP: legacy.topP,
			maxTokens: legacy.maxTokens,
			requestTimeoutSec: legacy.requestTimeoutSec,
			prompt: legacy.tagsPrompt,
		},
	});
}

function readAndNormalize(storageKey: string): ArticleAIWorkbenchSettings | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(storageKey);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (isRecord(parsed) && "summary" in parsed && "tags" in parsed) {
			return normalizeSettings(parsed as PartialArticleAIWorkbenchSettings);
		}
		return migrateLegacySettings(parsed);
	} catch {
		return null;
	}
}

function mergeFeature(
	current: ArticleAIFeatureSettings,
	patch?: Partial<ArticleAIFeatureSettings>,
): Partial<ArticleAIFeatureSettings> | undefined {
	if (!patch) return undefined;
	return { ...current, ...patch };
}

export function getDefaultArticleAISettings(): ArticleAIWorkbenchSettings {
	return DEFAULT_ARTICLE_AI_SETTINGS;
}

export function getDefaultArticleAIFeatureSettings(key: ArticleAIFeatureKey): ArticleAIFeatureSettings {
	return DEFAULT_ARTICLE_AI_SETTINGS[key];
}

export function getLocalArticleAISettings(): ArticleAIWorkbenchSettings {
	if (typeof window === "undefined") {
		return DEFAULT_ARTICLE_AI_SETTINGS;
	}

	const current = readAndNormalize(STORAGE_KEY);
	if (current) {
		return current;
	}

	const legacy = readAndNormalize(LEGACY_STORAGE_KEY);
	if (legacy) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
		window.localStorage.removeItem(LEGACY_STORAGE_KEY);
		return legacy;
	}

	return DEFAULT_ARTICLE_AI_SETTINGS;
}

export function saveLocalArticleAISettings(
	settings: PartialArticleAIWorkbenchSettings,
): ArticleAIWorkbenchSettings {
	const current = getLocalArticleAISettings();
	const next = normalizeSettings({
		...current,
		summary: mergeFeature(current.summary, settings.summary),
		tags: mergeFeature(current.tags, settings.tags),
		title: mergeFeature(current.title, settings.title),
		content: mergeFeature(current.content, settings.content),
		cover: mergeFeature(current.cover, settings.cover),
	});

	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}

	return next;
}

export function getLocalArticleAIFeatureSettings(
	key: ArticleAIFeatureKey,
): ArticleAIFeatureSettings {
	return getLocalArticleAISettings()[key];
}

export function saveLocalArticleAIFeatureSettings(
	key: ArticleAIFeatureKey,
	settings: Partial<ArticleAIFeatureSettings>,
): ArticleAIWorkbenchSettings {
	const current = getLocalArticleAISettings();
	const patch: PartialArticleAIWorkbenchSettings = {
		[key]: {
			...current[key],
			...settings,
		},
	};
	return saveLocalArticleAISettings(patch);
}

export function toArticleAIRequestSettings(
	key: "summary" | "tags",
	input?: ArticleAIFeatureSettings,
): ArticleAISettings {
	const resolved = normalizeFeatureSettings(
		input,
		getDefaultArticleAIFeatureSettings(key),
	);

	return {
		model: resolved.model,
		temperature: resolved.temperature,
		topP: resolved.topP,
		maxTokens: resolved.maxTokens,
		requestTimeoutSec: resolved.requestTimeoutSec,
		summaryPrompt:
			key === "summary"
				? resolved.prompt
				: DEFAULT_ARTICLE_AI_SETTINGS.summary.prompt,
		tagsPrompt:
			key === "tags"
				? resolved.prompt
				: DEFAULT_ARTICLE_AI_SETTINGS.tags.prompt,
	};
}
