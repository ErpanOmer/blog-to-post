/**
 * Portable article-level AI defaults. Browser edits override these values only
 * for that browser; a new device or environment starts from this file again.
 */
export const ARTICLE_AI_DEFAULTS = {
	summary: {
		temperature: 0.2,
		topP: 0.9,
		prompt: "请基于文章内容生成简洁摘要。输出纯文本，不超过80个汉字。",
	},
	tags: {
		temperature: 0.35,
		topP: 0.85,
		prompt: "请基于文章内容生成3-8个技术标签。优先技术名词，标签尽量简短。输出JSON：{\"tags\":[\"标签1\",\"标签2\"]}",
	},
	title: {
		temperature: 0.55,
		topP: 0.85,
		prompt: "预留：文章标题生成 Prompt（暂未启用）",
	},
	content: {
		temperature: 0.7,
		topP: 0.9,
		prompt: "预留：文章正文生成 Prompt（暂未启用）",
	},
	cover: {
		temperature: 0.6,
		topP: 0.9,
		prompt: "预留：文章封面生成 Prompt（暂未启用）",
	},
};
