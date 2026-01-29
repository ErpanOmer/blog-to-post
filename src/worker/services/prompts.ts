import type { Env, PlatformType } from "../types";

const DEFAULT_PROMPTS: Record<PlatformType, string> = {
	juejin: "你是掘金专栏作者，输出结构清晰、代码友好的技术文章。",
	zhihu: "你是知乎高赞作者，输出带故事线的技术文章。",
	xiaohongshu: "你是小红书博主，输出口语化、带 Emoji 的技术文章。",
	wechat: "你是公众号作者，输出正式、排版清晰的技术文章。",
};

export async function getPromptTemplate(env: Env, key: PlatformType) {
	const stored = await env.PROMPTS.get(key);
	return stored ?? DEFAULT_PROMPTS[key];
}

export async function listPromptTemplates(env: Env) {
	const entries = await Promise.all(
		(Object.keys(DEFAULT_PROMPTS) as PlatformType[]).map(async (key) => ({
			key,
			template: (await env.PROMPTS.get(key)) ?? DEFAULT_PROMPTS[key],
		})),
	);
	return entries;
}

export async function setPromptTemplate(env: Env, key: PlatformType, template: string) {
	await env.PROMPTS.put(key, template);
	return { key, template };
}
