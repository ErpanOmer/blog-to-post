import type { Article, ArticleStatus, PlatformType } from "../types";

function mapArticle(row: Article): Article {
	return {
		...row,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export async function listArticles(db: D1Database): Promise<Article[]> {
	const result = await db.prepare("SELECT * FROM articles ORDER BY createdAt DESC").all<Article>();
	return (result.results ?? []).map(mapArticle);
}

export async function getArticle(db: D1Database, id: string): Promise<Article | null> {
	const result = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first<Article>();
	return result ? mapArticle(result) : null;
}

export async function createArticle(
	db: D1Database,
	payload: { id: string; title: string; content: string; platform: PlatformType; status: ArticleStatus; createdAt: number; updatedAt: number },
): Promise<Article> {
	await db.prepare(
		"INSERT INTO articles (id, title, content, platform, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(payload.id, payload.title, payload.content, payload.platform, payload.status, payload.createdAt, payload.updatedAt)
		.run();
	return { ...payload };
}

export async function updateArticle(
	db: D1Database,
	id: string,
	payload: { title?: string; content?: string; platform?: PlatformType },
) {
	const current = await getArticle(db, id);
	if (!current) {
		return null;
	}
	const next = {
		title: payload.title ?? current.title,
		content: payload.content ?? current.content,
		platform: payload.platform ?? current.platform,
		updatedAt: Date.now(),
	};
	await db.prepare("UPDATE articles SET title = ?, content = ?, platform = ?, updatedAt = ? WHERE id = ?")
		.bind(next.title, next.content, next.platform, next.updatedAt, id)
		.run();
	return { ...current, ...next };
}

export async function updateArticleStatus(db: D1Database, id: string, status: ArticleStatus) {
	const current = await getArticle(db, id);
	if (!current) {
		return null;
	}
	const updatedAt = Date.now();
	await db.prepare("UPDATE articles SET status = ?, updatedAt = ? WHERE id = ?").bind(status, updatedAt, id).run();
	return { ...current, status, updatedAt };
}
