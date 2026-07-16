import type { Article } from "@/react-app/types";

const ARTICLE_DRAFT_BACKUP_PREFIX = "blog-to-post:article-draft-backup:";
const ARTICLE_DRAFT_BACKUP_INDEX_KEY = "blog-to-post:article-draft-backup:index";

export interface ArticleDraftBackup {
	article: Article;
	savedAt: number;
}

function getBackupStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

export function getArticleDraftBackupKey(articleId: string): string {
	return `${ARTICLE_DRAFT_BACKUP_PREFIX}${articleId}`;
}

function readIndex(storage: Storage): string[] {
	try {
		const parsed = JSON.parse(storage.getItem(ARTICLE_DRAFT_BACKUP_INDEX_KEY) || "[]") as unknown;
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

function writeIndex(storage: Storage, ids: string[]) {
	try {
		storage.setItem(ARTICLE_DRAFT_BACKUP_INDEX_KEY, JSON.stringify([...new Set(ids)]));
	} catch {
		// Storage can be unavailable or full. Draft editing must continue regardless.
	}
}

function parseBackup(raw: string | null): ArticleDraftBackup | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<ArticleDraftBackup>;
		if (!parsed.article?.id || typeof parsed.savedAt !== "number") return null;
		return parsed as ArticleDraftBackup;
	} catch {
		return null;
	}
}

export function saveArticleDraftBackup(article: Article): ArticleDraftBackup | null {
	const storage = getBackupStorage();
	if (!storage) return null;

	const backup: ArticleDraftBackup = {
		article: { ...article, updatedAt: Date.now() },
		savedAt: Date.now(),
	};
	try {
		storage.setItem(getArticleDraftBackupKey(article.id), JSON.stringify(backup));
		writeIndex(storage, [article.id, ...readIndex(storage)]);
		return backup;
	} catch {
		return null;
	}
}

export function readArticleDraftBackup(articleId: string): ArticleDraftBackup | null {
	const storage = getBackupStorage();
	if (!storage) return null;
	try {
		return parseBackup(storage.getItem(getArticleDraftBackupKey(articleId)));
	} catch {
		return null;
	}
}

export function readLatestTempArticleDraftBackup(persistedArticleIds: Iterable<string> = []): ArticleDraftBackup | null {
	const storage = getBackupStorage();
	if (!storage) return null;
	const persistedIds = new Set(persistedArticleIds);
	const indexedIds = readIndex(storage);
	const validIds: string[] = [];
	const backups: ArticleDraftBackup[] = [];

	for (const id of indexedIds) {
		const backup = readArticleDraftBackup(id);
		if (!backup) continue;
		validIds.push(id);
		if (backup.article.id.startsWith("temp-") && !persistedIds.has(backup.article.id)) {
			backups.push(backup);
		}
	}

	if (validIds.length !== indexedIds.length) {
		writeIndex(storage, validIds);
	}

	return backups.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

export function clearArticleDraftBackup(articleId: string) {
	const storage = getBackupStorage();
	if (!storage) return;

	try {
		storage.removeItem(getArticleDraftBackupKey(articleId));
		writeIndex(storage, readIndex(storage).filter((id) => id !== articleId));
	} catch {
		// Best effort cleanup only.
	}
}

export function shouldRestoreArticleDraftBackup(article: Article, backup: ArticleDraftBackup | null): backup is ArticleDraftBackup {
	if (!backup) return false;
	return backup.savedAt > (article.updatedAt || article.createdAt || 0);
}
