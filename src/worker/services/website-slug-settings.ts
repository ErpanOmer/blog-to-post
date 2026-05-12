import type { Env } from "@/worker/types";

const WEBSITE_SLUG_SETTINGS_KEY = "website:slug-settings";

export interface WebsiteSlugSettings {
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
	systemPrompt: string;
}

export const DEFAULT_WEBSITE_SLUG_SYSTEM_PROMPT = `You generate SEO-friendly URL slugs for a personal technical blog.

Rules:
- Output JSON only: {"slug":"..."}.
- The slug must be lowercase English words separated by hyphens.
- Use 4 to 10 meaningful words.
- Prefer keywords that match the article title and search intent.
- Do not include dates unless the title requires them.
- Do not include punctuation, emoji, Chinese characters, underscores, quotes, or explanations.
- Keep it readable, stable, and suitable for /blog/{slug}.`;

export const DEFAULT_WEBSITE_SLUG_SETTINGS: WebsiteSlugSettings = {
	model: "",
	temperature: 0.25,
	topP: 0.85,
	maxTokens: 128,
	requestTimeoutSec: 90,
	systemPrompt: DEFAULT_WEBSITE_SLUG_SYSTEM_PROMPT,
};

function normalizeString(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim();
	return trimmed || fallback;
}

function normalizeOptionalString(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function normalizeWebsiteSlugSettings(input?: unknown): WebsiteSlugSettings {
	const source = input && typeof input === "object"
		? input as Partial<WebsiteSlugSettings>
		: {};
	return {
		model: normalizeOptionalString(source.model),
		temperature: normalizeNumber(source.temperature, DEFAULT_WEBSITE_SLUG_SETTINGS.temperature, 0, 2),
		topP: normalizeNumber(source.topP, DEFAULT_WEBSITE_SLUG_SETTINGS.topP, 0, 1),
		maxTokens: normalizeNumber(source.maxTokens, DEFAULT_WEBSITE_SLUG_SETTINGS.maxTokens, 16, 512),
		requestTimeoutSec: normalizeNumber(source.requestTimeoutSec, DEFAULT_WEBSITE_SLUG_SETTINGS.requestTimeoutSec, 10, 300),
		systemPrompt: normalizeString(source.systemPrompt, DEFAULT_WEBSITE_SLUG_SETTINGS.systemPrompt),
	};
}

export async function getWebsiteSlugSettings(env: Env): Promise<WebsiteSlugSettings> {
	if (!env.PROMPTS) {
		return DEFAULT_WEBSITE_SLUG_SETTINGS;
	}

	const raw = await env.PROMPTS.get(WEBSITE_SLUG_SETTINGS_KEY);
	if (!raw) return DEFAULT_WEBSITE_SLUG_SETTINGS;

	try {
		return normalizeWebsiteSlugSettings(JSON.parse(raw));
	} catch {
		return DEFAULT_WEBSITE_SLUG_SETTINGS;
	}
}

export async function setWebsiteSlugSettings(
	env: Env,
	payload: unknown,
): Promise<WebsiteSlugSettings> {
	const current = await getWebsiteSlugSettings(env);
	const next = normalizeWebsiteSlugSettings({ ...current, ...(payload as object) });
	if (!env.PROMPTS) {
		return next;
	}
	await env.PROMPTS.put(WEBSITE_SLUG_SETTINGS_KEY, JSON.stringify(next));
	return next;
}
