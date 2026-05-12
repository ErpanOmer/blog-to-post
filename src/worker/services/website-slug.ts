import { createAIProvider } from "@/worker/ai/providers";
import type { Env } from "@/worker/types";
import { safeParseJson } from "@/worker/utils/json-parser";
import { getWebsiteSlugSettings } from "@/worker/services/website-slug-settings";

export interface GenerateWebsiteSlugInput {
	title: string;
	description?: string | null;
	content?: string | null;
	tags?: string[] | null;
}

function fallbackSlugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, 90);
}

export function normalizeWebsiteSlugCandidate(value: string): string {
	return fallbackSlugify(value).split("-").filter(Boolean).slice(0, 10).join("-");
}

function pickSlugFromModelOutput(raw: string): string {
	const parsed = safeParseJson<{ slug?: unknown } | string | null>(raw, null);
	if (typeof parsed === "string") return parsed;
	if (parsed && typeof parsed.slug === "string") return parsed.slug;

	const line = raw
		.replace(/```(?:json)?/gi, "")
		.replace(/```/g, "")
		.split(/\r?\n/)
		.map((item) => item.trim())
		.find(Boolean);
	return line ?? "";
}

export async function generateWebsiteSlug(
	env: Env,
	input: GenerateWebsiteSlugInput,
	options: { allowFallback?: boolean } = {},
): Promise<string> {
	const title = input.title?.trim();
	if (!title) {
		throw new Error("Title is required to generate website slug");
	}

	const settings = await getWebsiteSlugSettings(env);
	const provider = createAIProvider(env);
	const userPrompt = JSON.stringify({
		title,
		description: input.description ?? "",
		tags: input.tags ?? [],
		contentPreview: (input.content ?? "").slice(0, 1600),
	});

	const raw = await provider.generateSummary(settings.systemPrompt, userPrompt, {
		model: settings.model,
		temperature: settings.temperature,
		topP: settings.topP,
		maxTokens: settings.maxTokens,
		requestTimeoutSec: settings.requestTimeoutSec,
		format: "json",
		think: false,
	});
	const normalized = normalizeWebsiteSlugCandidate(pickSlugFromModelOutput(raw));
	if (normalized) return normalized;

	if (options.allowFallback) {
		const fallback = normalizeWebsiteSlugCandidate(title);
		if (fallback) return fallback;
	}

	throw new Error("AI failed to generate a valid SEO-friendly website slug");
}
