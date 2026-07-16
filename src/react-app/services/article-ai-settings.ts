import type { ArticleAISettings } from "@/react-app/types";
import { ARTICLE_AI_DEFAULTS } from "@/react-app/services/article-ai-defaults";

const STORAGE_KEY = "article-ai-settings:v2";
const LEGACY_STORAGE_KEY = "article-ai-settings:v1";

export type ArticleAIFeatureKey = "summary" | "tags" | "title" | "content" | "cover";

export interface ArticleAIFeatureSettings {
	temperature: number;
	topP: number;
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

const DEFAULT_ARTICLE_AI_SETTINGS: ArticleAIWorkbenchSettings = ARTICLE_AI_DEFAULTS;

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function normalizePrompt(value: unknown, fallback: string): string {
	if (typeof value !== "string" || !value.trim()) return fallback;
	return value.trim();
}

function normalizeFeatureSettings(
	input: Partial<ArticleAIFeatureSettings> | undefined,
	fallback: ArticleAIFeatureSettings,
): ArticleAIFeatureSettings {
	return {
		temperature: normalizeNumber(input?.temperature, fallback.temperature, 0, 2),
		topP: normalizeNumber(input?.topP, fallback.topP, 0, 1),
		prompt: normalizePrompt(input?.prompt, fallback.prompt),
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

	if ("summary" in raw || "tags" in raw) {
		return normalizeSettings(raw as PartialArticleAIWorkbenchSettings);
	}

	const legacy = raw as Partial<ArticleAISettings>;
	if (
		legacy.temperature === undefined
		&& legacy.topP === undefined
		&& legacy.summaryPrompt === undefined
		&& legacy.tagsPrompt === undefined
	) {
		return null;
	}

	return normalizeSettings({
		summary: {
			temperature: legacy.temperature,
			topP: legacy.topP,
			prompt: legacy.summaryPrompt,
		},
		tags: {
			temperature: legacy.temperature,
			topP: legacy.topP,
			prompt: legacy.tagsPrompt,
		},
	});
}

function readAndNormalize(storageKey: string): ArticleAIWorkbenchSettings | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(storageKey);
	if (!raw) return null;
	try {
		return migrateLegacySettings(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function getDefaultArticleAISettings(): ArticleAIWorkbenchSettings {
	return DEFAULT_ARTICLE_AI_SETTINGS;
}

export function getDefaultArticleAIFeatureSettings(key: ArticleAIFeatureKey): ArticleAIFeatureSettings {
	return DEFAULT_ARTICLE_AI_SETTINGS[key];
}

export function getLocalArticleAISettings(): ArticleAIWorkbenchSettings {
	if (typeof window === "undefined") return DEFAULT_ARTICLE_AI_SETTINGS;

	const current = readAndNormalize(STORAGE_KEY);
	if (current) return current;

	const legacy = readAndNormalize(LEGACY_STORAGE_KEY);
	if (legacy) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
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
		summary: { ...current.summary, ...settings.summary },
		tags: { ...current.tags, ...settings.tags },
		title: { ...current.title, ...settings.title },
		content: { ...current.content, ...settings.content },
		cover: { ...current.cover, ...settings.cover },
	});

	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
	return next;
}

export function getLocalArticleAIFeatureSettings(key: ArticleAIFeatureKey): ArticleAIFeatureSettings {
	return getLocalArticleAISettings()[key];
}

export function toArticleAIRequestSettings(
	key: "summary" | "tags",
	input?: ArticleAIFeatureSettings,
): ArticleAISettings {
	const resolved = normalizeFeatureSettings(input, DEFAULT_ARTICLE_AI_SETTINGS[key]);
	return {
		temperature: resolved.temperature,
		topP: resolved.topP,
		summaryPrompt: key === "summary" ? resolved.prompt : DEFAULT_ARTICLE_AI_SETTINGS.summary.prompt,
		tagsPrompt: key === "tags" ? resolved.prompt : DEFAULT_ARTICLE_AI_SETTINGS.tags.prompt,
	};
}
