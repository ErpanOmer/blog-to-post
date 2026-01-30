import type { Env, PlatformType } from "./types";
import { createAIProvider } from "./ai/providers";
import { createArticle } from "./db/articles";
import { createTask } from "./db/tasks";
import { saveDraft } from "./services/storage";
import titleSystemPrompt from "./prompts/generate-title-system-prompt.txt?raw";
import titleUserPromptTpl from "./prompts/generate-title-user-prompt.txt?raw";
import generateContentSystemPrompt from "./prompts/generate-content-system-prompt.txt?raw";
import generateContentUserPrompt from "./prompts/generate-content-user-prompt.txt?raw";

import fetchJuejinTopTitles from "./juejin";
import { pickFirstLine } from "./index";

const CANDIDATE_KEY = "candidate_titles";
const PLATFORMS: PlatformType[] = ["juejin", "zhihu", "xiaohongshu", "wechat"];
const fallbackTitle = "AI 驱动的多平台内容分发流程实践";

export async function generateCandidateTitles(env: Env) {
	const provider = createAIProvider(env);
	const titlesData = await fetchJuejinTopTitles();
	const userPrompt = titleUserPromptTpl
		.replace("{{USER_PAST_TITLES}}", titlesData.userTitles.join("\n") || "无数据")
		.replace("{{JUEJIN_TOP_20_TITLES}}", titlesData.juejinTitles.join("\n") || fallbackTitle);
	const content = await provider.generateTitleText(titleSystemPrompt, userPrompt);
	await env.PROMPTS.put(CANDIDATE_KEY, content);
	return content;
}


export async function generateDailyDrafts(env: Env) {
	const provider = createAIProvider(env);
	const candidateRaw = await env.PROMPTS.get(CANDIDATE_KEY);
	const title = pickFirstLine(candidateRaw ?? "") || fallbackTitle;

	await Promise.all(
		PLATFORMS.map(async (platform) => {
			const userPrompt = generateContentUserPrompt.replace("{{TITLE}}", title);
			const systemPrompt = generateContentSystemPrompt.replace("{{TITLE}}", title);
			const draftContent = await provider.generateMarkdownContent(systemPrompt, userPrompt);

			const content = draftContent || `# ${title}\n\n待补充正文内容。`;
			const id = crypto.randomUUID();
			const now = Date.now();
			await createArticle(env.DB, {
				id,
				title,
				content,
				summary: "摘要待补充",
				tags: ["draft"],
				coverImage: "/vite.svg",
				platform,
				status: "draft",
				createdAt: now,
				updatedAt: now,
			});
			await saveDraft(env, id, content);

			await createTask(env.DB, {
				id: crypto.randomUUID(),
				type: "generate",
				status: "success",
				payload: { articleId: id, platform },
			});
		}),
	);
}

export async function autoReviewDrafts(env: Env) {
	await env.DB.prepare("UPDATE articles SET status = 'reviewed' WHERE status = 'draft'").run();
}

export async function runDailyCron(env: Env) {
	await generateCandidateTitles(env);
	await generateDailyDrafts(env);
	await autoReviewDrafts(env);
}

