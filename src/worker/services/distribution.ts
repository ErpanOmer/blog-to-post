import type { ArticleStatus } from "../types";
import { updateArticleStatus } from "../db/articles";

const transitions: Record<ArticleStatus, ArticleStatus[]> = {
	draft: ["reviewed", "scheduled", "failed"],
	reviewed: ["scheduled", "published", "failed"],
	scheduled: ["published", "failed"],
	published: [],
	failed: ["draft"],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus) {
	return transitions[from]?.includes(to);
}

export async function transitionArticle(db: D1Database, id: string, status: ArticleStatus) {
	const current = await updateArticleStatus(db, id, status);
	return current;
}
