import type { Article, ArticleStatus, PlatformType } from "../types";

type ArticleRow = Article & {
	summary?: string | null;
	tags?: string | null;
	coverImage?: string | null;
	publishedAt?: number | null;
};

function mapArticle(row: ArticleRow): Article {
	let tags: string[] | null = null;
	if (row.tags) {
		try {
			tags = JSON.parse(row.tags) as string[];
		} catch {
			tags = row.tags.split(",").map((item) => item.trim()).filter(Boolean);
		}
	}
	return {
		...row,
		summary: row.summary ?? null,
		tags,
		coverImage: row.coverImage ?? null,
		publishedAt: row.publishedAt ?? null,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export async function listArticles(db: D1Database): Promise<Article[]> {
	const result = await db.prepare("SELECT * FROM articles ORDER BY createdAt DESC").all<ArticleRow>();
	return (result.results ?? []).map(mapArticle);
}

export async function getArticle(db: D1Database, id: string): Promise<Article | null> {
	const result = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first<ArticleRow>();
	return result ? mapArticle(result) : null;
}

export async function createArticle(
	db: D1Database,
	payload: {
		id: string;
		title: string;
		content: string;
		summary?: string | null;
		tags?: string[] | null;
		coverImage?: string | null;
		platform: PlatformType;
		status: ArticleStatus;
		publishedAt?: number | null;
		createdAt: number;
		updatedAt: number;
	},
): Promise<Article> {
	await db.prepare(
		"INSERT INTO articles (id, title, content, summary, tags, coverImage, platform, status, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			payload.id,
			payload.title,
			payload.content,
			payload.summary ?? null,
			payload.tags ? JSON.stringify(payload.tags) : null,
			payload.coverImage ?? null,
			payload.platform,
			payload.status,
			payload.publishedAt ?? null,
			payload.createdAt,
			payload.updatedAt,
		)
		.run();
	return { ...payload } as Article;
}

export async function updateArticle(
	db: D1Database,
	id: string,
	payload: { title?: string; content?: string; platform?: PlatformType; summary?: string | null; tags?: string[] | null; coverImage?: string | null },
) {
	const current = await getArticle(db, id);
	if (!current) {
		return null;
	}
	const next = {
		title: payload.title ?? current.title,
		content: payload.content ?? current.content,
		platform: payload.platform ?? current.platform,
		summary: payload.summary ?? current.summary ?? null,
		tags: payload.tags ?? current.tags ?? null,
		coverImage: payload.coverImage ?? current.coverImage ?? null,
		updatedAt: Date.now(),
	};
	await db.prepare("UPDATE articles SET title = ?, content = ?, summary = ?, tags = ?, coverImage = ?, platform = ?, updatedAt = ? WHERE id = ?")
		.bind(next.title, next.content, next.summary, next.tags ? JSON.stringify(next.tags) : null, next.coverImage, next.platform, next.updatedAt, id)
		.run();
	return { ...current, ...next } as Article;
}

export async function updateArticleStatus(db: D1Database, id: string, status: ArticleStatus) {
	const current = await getArticle(db, id);
	if (!current) {
		return null;
	}
	const updatedAt = Date.now();
	const publishedAt = status === "published" ? Date.now() : current.publishedAt ?? null;
	await db.prepare("UPDATE articles SET status = ?, updatedAt = ?, publishedAt = ? WHERE id = ?")
		.bind(status, updatedAt, publishedAt, id)
		.run();
	return { ...current, status, updatedAt, publishedAt } as Article;
}

export async function deleteArticle(db: D1Database, id: string): Promise<boolean> {
	const current = await getArticle(db, id);
	if (!current) {
		return false;
	}
	// 只允许删除草稿状态的文章
	if (current.status !== 'draft') {
		return false;
	}
	await db.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
	return true;
}

