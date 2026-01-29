import type { Env, GenerateInput, PlatformType } from "./types";
import { createAIProvider } from "./ai/providers";
import { createArticle } from "./db/articles";
import { createTask } from "./db/tasks";
import { saveDraft } from "./services/storage";

const CANDIDATE_KEY = "candidate_titles";
const PLATFORMS: PlatformType[] = ["juejin", "zhihu", "xiaohongshu", "wechat"];

export async function generateCandidateTitles(env: Env) {
	const provider = createAIProvider(env);
	const prompt: GenerateInput = {
		title: "生成 5 个技术文章标题，围绕工程效率与多平台分发。",
		platform: "juejin",
		tone: "technical",
		length: "short",
	};
	const content = await provider.generateArticle(prompt);
	await env.PROMPTS.put(CANDIDATE_KEY, content);
	return content;
}

export async function generateDailyDrafts(env: Env) {
	const provider = createAIProvider(env);
	const candidateRaw = await env.PROMPTS.get(CANDIDATE_KEY);
	const fallbackTitle = "AI 驱动的多平台内容分发流程实践";
	const title = candidateRaw?.split("\n").find((line: string) => line.trim()) ?? fallbackTitle;

	await Promise.all(
		PLATFORMS.map(async (platform) => {
			const draftContent = await provider.generateArticle({
				title,
				platform,
				tone: "technical",
				length: "medium",
			});
			const id = crypto.randomUUID();
			const now = Date.now();
			await createArticle(env.DB, {
				id,
				title,
				content: draftContent,
				platform,
				status: "draft",
				createdAt: now,
				updatedAt: now,
			});
			await saveDraft(env, id, draftContent);
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
