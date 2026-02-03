import type { Env, PromptKey } from "@/worker/types";
import titlePrompt from "@/worker/prompts/title.prompt.txt?raw";
import generateContentSystemPrompt from "@/worker/prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "@/worker/prompts/generate-content-user-prompt.txt?raw";
import summaryPrompt from "@/worker/prompts/summary.prompt.txt?raw";
import tagsPrompt from "@/worker/prompts/tags.prompt.txt?raw";
import coverPrompt from "@/worker/prompts/cover.prompt.txt?raw";

const DEFAULT_PROMPTS: Record<PromptKey, string> = {
	title: titlePrompt,
	content: `${generateContentSystemPrompt}\n\n${generateContentUserPrompt}`,
	summary: summaryPrompt,
	tags: tagsPrompt,
	cover: coverPrompt,
};


export async function getPromptTemplate(env: Env, key: PromptKey) {
	const stored = await env.PROMPTS.get(`prompt:${key}`);
	return stored ?? DEFAULT_PROMPTS[key];
}

export async function listPromptTemplates(env: Env) {
	const entries = await Promise.all(
		(Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map(async (key) => ({
			key,
			template: (await env.PROMPTS.get(`prompt:${key}`)) ?? DEFAULT_PROMPTS[key],
		})),
	);
	return entries;
}

export async function setPromptTemplate(env: Env, key: PromptKey, template: string) {
	await env.PROMPTS.put(`prompt:${key}`, template);
	return { key, template };
}

