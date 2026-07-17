import { Hono } from "hono";
import type { Env, PlatformType, GenerateCoverInput } from "@/worker/types";
import { canTransition } from "@/worker/services/distribution";
import {
	listArticles,
	getArticle,
	createArticle,
	updateArticle,
	deleteArticle,
} from "@/worker/db/articles";
import { saveDraft } from "@/worker/services/storage";
import { createTask } from "@/worker/db/tasks";
import { createAIProvider } from "@/worker/ai/providers";
import { getCachedJuejinTitles } from "@/worker/services/juejin-cache";
import { transitionArticle } from "@/worker/services/distribution";
import {
	getArticlePublicationsByArticleId,
	listArticlePublications,
	updateArticlePublication,
} from "@/worker/db/publications";
import { getPlatformAccount } from "@/worker/db/platform-accounts";
import type { ArticlePublication } from "@/worker/types/publications";
import { extractStringArray, safeParseJson } from "@/worker/utils/json-parser";
import { pickFirstLine } from "@/worker/utils/text";
import { normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";
import { getPromptTemplate } from "@/worker/services/prompts";

import titleUserPromptTplRaw from "@/worker/prompts/generate-title-user-prompt.txt?raw";

const app = new Hono<{ Bindings: Env }>();
const fallbackCover = "/vite.svg";

interface ArticleAILocalOverrides {
	temperature?: number;
	topP?: number;
	summaryPrompt?: string;
	tagsPrompt?: string;
}

function normalizeArticleAILocalOverrides(input: unknown): ArticleAILocalOverrides {
	if (!input || typeof input !== "object") return {};
	const source = input as Record<string, unknown>;
	const temperature = typeof source.temperature === "number" && Number.isFinite(source.temperature)
		? Math.min(2, Math.max(0, source.temperature))
		: undefined;
	const topP = typeof source.topP === "number" && Number.isFinite(source.topP)
		? Math.min(1, Math.max(0, source.topP))
		: undefined;
	const summaryPrompt = typeof source.summaryPrompt === "string" && source.summaryPrompt.trim()
		? source.summaryPrompt.trim()
		: undefined;
	const tagsPrompt = typeof source.tagsPrompt === "string" && source.tagsPrompt.trim()
		? source.tagsPrompt.trim()
		: undefined;
	return { temperature, topP, summaryPrompt, tagsPrompt };
}

function resolvePromptInput(template: string, content: string): {
	systemPrompt: string;
	userPrompt: string;
} {
	const marker = "{{ARTICLE_CONTENT}}";
	if (template.includes(marker)) {
		return {
			systemPrompt: template.split(marker).join(content),
			userPrompt: "",
		};
	}

	return {
		systemPrompt: template,
		userPrompt: content,
	};
}

function normalizeSummaryText(text: string): string {
	const collapsed = text
		.replace(/\r/g, "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");

	return collapsed
		.replace(/^#+\s*/, "")
		.replace(/^["'`]+|["'`]+$/g, "")
		.trim();
}

function extractSummaryText(summaryRaw: string): string {
	const parsed = safeParseJson<{ summary?: unknown } | string | null>(summaryRaw, null);

	let candidate = "";
	if (typeof parsed === "string") {
		candidate = parsed;
	} else if (parsed && typeof parsed.summary === "string") {
		candidate = parsed.summary;
	}

	if (!candidate) {
		candidate = pickFirstLine(summaryRaw);
	}

	return normalizeSummaryText(candidate);
}

// Get article list
app.get("/", async (c) => {
	const articles = await listArticles(c.env.DB);
	return c.json(articles);
});

// Search articles
app.get("/search", async (c) => {
	const query = c.req.query("q")?.trim() ?? "";
	if (!query) {
		return c.json([]);
	}
	const articles = await listArticles(c.env.DB);
	const lowered = query.toLowerCase();
	const filtered = articles.filter((article) =>
		article.title.toLowerCase().includes(lowered)
		|| article.content.toLowerCase().includes(lowered)
		|| article.summary?.toLowerCase().includes(lowered),
	);
	return c.json(filtered);
});

// Juejin top titles
app.get("/juejin/top", async (c) => {
	const titlesData = await getCachedJuejinTitles(c.env);
	return c.json(titlesData);
});

// Generate title
app.post("/generate-title", async (c) => {
	const provider = createAIProvider(c.env);
	const titlesData = await getCachedJuejinTitles(c.env);
	const juejinTitles = titlesData.juejinTitles ?? [];
	const userPastTitles = titlesData.userTitles ?? [];

	const systemPrompt = await getPromptTemplate(c.env, "title");
	const userPrompt = titleUserPromptTplRaw
		.replace("{{USER_PAST_TITLES}}", userPastTitles.join("\n") || "no-data")
		.replace("{{JUEJIN_TOP_20_TITLES}}", juejinTitles.join("\n") || "no-data");

	const titleRaw = await provider.generateTitleText(systemPrompt, userPrompt);
	const titles = extractStringArray(titleRaw, 5);

	return c.json({ titles, count: titles.length });
});

// Generate content
app.post("/generate-content", async (c) => {
	const { title } = (await c.req.json()) as { title: string };
	if (!title || !title.trim()) {
		return c.json({ error: "Title is required" }, 400);
	}

	const provider = createAIProvider(c.env);
	const prompt = (await getPromptTemplate(c.env, "content")).replaceAll("{{TITLE}}", title);
	const content = await provider.generateMarkdownContent(prompt, `请围绕标题“${title}”生成完整 Markdown 正文。`);
	return c.json({ content });
});

// Generate summary
app.post("/generate-summary", async (c) => {
	const payload = (await c.req.json()) as { content: string; settings?: unknown };
	const { content } = payload;
	const resolvedContent = content?.trim() || "";
	if (!resolvedContent) {
		return c.json({ message: "content required" }, 400);
	}

	const provider = createAIProvider(c.env);
	const settings = normalizeArticleAILocalOverrides(payload.settings);
	const prompt = resolvePromptInput(
		settings.summaryPrompt ?? await getPromptTemplate(c.env, "summary"),
		resolvedContent,
	);
	const summaryRaw = await provider.generateSummary(prompt.systemPrompt, prompt.userPrompt, {
		temperature: settings.temperature,
		topP: settings.topP,
	});
	return c.json({ summary: extractSummaryText(summaryRaw) });
});
// Generate tags
app.post("/generate-tags", async (c) => {
	const payload = (await c.req.json()) as { content: string; settings?: unknown };
	const { content } = payload;
	const resolvedContent = content?.trim() || "";
	if (!resolvedContent) {
		return c.json({ message: "content required" }, 400);
	}

	const provider = createAIProvider(c.env);
	const settings = normalizeArticleAILocalOverrides(payload.settings);
	const prompt = resolvePromptInput(
		settings.tagsPrompt ?? await getPromptTemplate(c.env, "tags"),
		resolvedContent,
	);
	const tagsRaw = await provider.generateTags(prompt.systemPrompt, prompt.userPrompt, {
		temperature: settings.temperature,
		topP: settings.topP,
	});

	const parsed = safeParseJson<{ tags?: unknown } | string[] | null>(tagsRaw, null);

	let tags: string[] = [];
	let explicitEmptyTags = false;
	if (Array.isArray(parsed)) {
		tags = parsed.map((item) => String(item).trim()).filter(Boolean);
		explicitEmptyTags = parsed.length === 0;
	} else if (parsed && Array.isArray(parsed.tags)) {
		tags = parsed.tags.map((item) => String(item).trim()).filter(Boolean);
		explicitEmptyTags = parsed.tags.length === 0;
	}

	// If the model explicitly returns {"tags":[]}, keep it empty.
	if (tags.length === 0 && !explicitEmptyTags) {
		tags = extractStringArray(tagsRaw, 10)
			.flatMap((item) => item.split(/[\u002c\uFF0C\u3001]/))
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return c.json({ tags: [...new Set(tags)].slice(0, 8) });
});
// Generate cover
app.post("/generate-cover", async (c) => {
	const { title, content } = (await c.req.json()) as GenerateCoverInput;
	const resolvedTitle = title?.trim();
	const resolvedContent = content?.trim() || "";
	if (!resolvedTitle) {
		return c.json({ message: "title required" }, 400);
	}
	const provider = createAIProvider(c.env);
	const userPrompt = `title: ${resolvedTitle}\nsummary:\ncontent:\n${resolvedContent}`;
	const coverRaw = await provider.generateImage(await getPromptTemplate(c.env, "cover"), userPrompt);
	const coverImage = pickFirstLine(coverRaw) || fallbackCover;
	return c.json({ coverImage });
});

// Get single article
app.get("/:id", async (c) => {
	const article = await getArticle(c.env.DB, c.req.param("id"));
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	return c.json(article);
});

// Create article
app.post("/", async (c) => {
	const payload = (await c.req.json()) as {
		title?: string;
		content?: string;
		htmlContent?: string;
		summary?: string | null;
		tags?: string[] | null;
		coverImage?: string | null;
		platform?: PlatformType;
	};
	const title = payload.title ?? "";
	const content = payload.content ?? "";
	if (!title.trim() && !content.trim()) {
		return c.json({ message: "title or content required" }, 400);
	}
	const now = Date.now();
	const normalizedContent = normalizeMarkdownImageSyntax(content);
	const article = await createArticle(c.env.DB, {
		id: crypto.randomUUID(),
		title,
		content: normalizedContent,
		summary: payload.summary,
		htmlContent: payload.htmlContent,
		tags: payload.tags,
		coverImage: payload.coverImage,
		platform: payload.platform ?? "",
		status: "draft",
		createdAt: now,
		updatedAt: now,
	});
	await saveDraft(c.env, article.id, article.content);
	await createTask(c.env.DB, {
		id: crypto.randomUUID(),
		type: "generate",
		status: "success",
		payload: { articleId: article.id },
	});
	return c.json(article);
});

// Update article
app.put("/:id", async (c) => {
	const payload = (await c.req.json()) as {
		title?: string;
		content?: string;
		htmlContent?: string;
		platform?: PlatformType;
		summary?: string | null;
		tags?: string[] | null;
		coverImage?: string | null;
	};
	const normalizedPayload = payload.content !== undefined
		? { ...payload, content: normalizeMarkdownImageSyntax(payload.content) }
		: payload;
	const article = await updateArticle(c.env.DB, c.req.param("id"), normalizedPayload);
	if (!article) {
		return c.json({ message: "not found" }, 404);
	}
	await saveDraft(c.env, article.id, article.content);
	return c.json(article);
});

// Delete article
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const current = await getArticle(c.env.DB, id);
	if (!current) {
		return c.json({ message: "not found" }, 404);
	}
	if (current.status !== "draft") {
		return c.json({ message: "only draft articles can be deleted" }, 400);
	}
	const success = await deleteArticle(c.env.DB, id);
	if (!success) {
		return c.json({ message: "delete failed" }, 500);
	}
	return c.json({ success: true });
});

// Transition article status
app.post("/:id/transition", async (c) => {
	const { status } = (await c.req.json()) as {
		status: "reviewed" | "scheduled" | "published" | "failed";
	};
	const current = await getArticle(c.env.DB, c.req.param("id"));

	if (!current) {
		return c.json({ message: "not found" }, 404);
	}

	const canMove = canTransition(current.status, status);
	if (!canMove) {
		return c.json({ message: `Cannot transition from ${current.status} to ${status}` }, 400);
	}

	const result = await transitionArticle(c.env.DB, current.id, status);
	return c.json(result);
});

const publicationLinkInvalidTextPatterns = [
	"404 not found",
	"error 404",
	"404 -",
	"page not found",
	"文章不存在",
	"内容不存在",
	"页面不存在",
	"该内容无法访问",
	"已被删除",
	"内容已删除",
	"链接已失效",
];
const publicationLinkCheckIntervalMs = 7 * 24 * 60 * 60 * 1000;
const publicationLinkCheckKeyPrefix = "article-publication-link-check:";

interface PublicationLinkCheckState {
	publishedUrl: string;
	publishId?: string | null;
	checkedAt: number;
	status: "valid" | "invalid" | "unverified" | "skipped_initial";
	reason?: string;
}

function getPublicationLinkCheckKey(publicationId: string): string {
	return `${publicationLinkCheckKeyPrefix}${publicationId}`;
}

function normalizeComparableUrl(value: string): string {
	return value.trim().replace(/\/+$/, "");
}

async function getPublicationLinkCheckState(
	env: Env,
	publicationId: string,
): Promise<PublicationLinkCheckState | null> {
	const raw = await env.PROMPTS.get(getPublicationLinkCheckKey(publicationId));
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<PublicationLinkCheckState>;
		if (!parsed.publishedUrl || typeof parsed.checkedAt !== "number") return null;
		return {
			publishedUrl: parsed.publishedUrl,
			publishId: parsed.publishId ?? null,
			checkedAt: parsed.checkedAt,
			status: parsed.status ?? "unverified",
			reason: parsed.reason,
		};
	} catch {
		return null;
	}
}

async function setPublicationLinkCheckState(
	env: Env,
	publication: ArticlePublication,
	publishedUrl: string,
	status: PublicationLinkCheckState["status"],
	reason?: string,
): Promise<void> {
	await env.PROMPTS.put(
		getPublicationLinkCheckKey(publication.id),
		JSON.stringify({
			publishedUrl,
			publishId: publication.publishId ?? null,
			checkedAt: Date.now(),
			status,
			reason,
		} satisfies PublicationLinkCheckState),
	);
}

function hasExpectedPublicationUrlShape(platform: PlatformType, rawUrl: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return false;
	}

	const host = parsed.hostname.toLowerCase();
	const pathname = parsed.pathname.toLowerCase();

	switch (platform) {
		case "csdn":
			return host.endsWith("csdn.net") && pathname.includes("/article/details/");
		case "juejin":
			return host.endsWith("juejin.cn") && /^\/post\/\d+/.test(pathname);
		case "segmentfault":
			return host.endsWith("segmentfault.com") && pathname.startsWith("/a/");
		case "51cto":
			return host.endsWith("51cto.com") && (
				pathname.includes("/blogger/draft/")
				|| pathname.includes("/blogger/success/")
				|| /^\/[^/]+\/\d+/.test(pathname)
			);
		case "cnblogs":
			return host.endsWith("cnblogs.com") && (
				pathname.includes("/p/")
				|| pathname.includes("/articles/")
				|| pathname.includes("/archive/")
			);
		case "zhihu":
			return host.endsWith("zhihu.com") && (
				pathname.startsWith("/p/")
				|| pathname.includes("/question/")
			);
		case "wechat":
			return host.endsWith("mp.weixin.qq.com") && pathname.startsWith("/s");
		default:
			return true;
	}
}

async function isPublicationUrlStillValid(publication: ArticlePublication): Promise<{
	valid: boolean;
	reason?: string;
}> {
	const rawUrl = publication.publishedUrl?.trim();
	if (!rawUrl) return { valid: false, reason: "empty_url" };
	if (!/^https?:\/\//i.test(rawUrl)) return { valid: false, reason: "unsupported_url" };
	if (!hasExpectedPublicationUrlShape(publication.platform, rawUrl)) {
		return { valid: false, reason: "unexpected_article_detail_url" };
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 8000);

	try {
		const response = await fetch(rawUrl, {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			headers: {
				accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"user-agent": "Mozilla/5.0 (compatible; BlogToPostLinkChecker/1.0)",
			},
		});

		if (!response.ok) {
			if (response.status === 404 || response.status === 410) {
				return { valid: false, reason: `http_${response.status}` };
			}
			// Some platforms, especially Zhihu, block server-side link checks with
			// 401/403/429 or transient edge errors while the browser URL is valid.
			// Keep structurally valid article links unless the response is a hard
			// not-found signal.
			return { valid: true, reason: `http_${response.status}_unverified_keep` };
		}

		const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
		if (!contentType.includes("text/html")) {
			return { valid: true };
		}

		const text = (await response.text()).slice(0, 200_000).toLowerCase();
		const invalidPattern = publicationLinkInvalidTextPatterns.find((pattern) => text.includes(pattern.toLowerCase()));
		if (invalidPattern) {
			return { valid: false, reason: `matched_${invalidPattern}` };
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: true,
			reason: error instanceof Error ? `${error.name}_unverified_keep` : "fetch_failed_unverified_keep",
		};
	} finally {
		clearTimeout(timeoutId);
	}
}

function restoreKnownPublishedUrlSync(publication: ArticlePublication): string | null {
	const publishId = publication.publishId?.trim();
	if (!publishId) return null;

	switch (publication.platform) {
		case "zhihu":
			return `https://zhuanlan.zhihu.com/p/${publishId}`;
		case "juejin":
			return `https://juejin.cn/post/${publishId}`;
		case "segmentfault":
			return `https://segmentfault.com/a/${publishId}`;
		default:
			return null;
	}
}

async function restoreKnownPublishedUrl(env: Env, publication: ArticlePublication): Promise<string | null> {
	const syncUrl = restoreKnownPublishedUrlSync(publication);
	if (syncUrl) return syncUrl;

	const publishId = publication.publishId?.trim();
	if (!publishId || !["cnblogs", "csdn"].includes(publication.platform)) return null;

	const account = await getPlatformAccount(env.DB, publication.accountId);
	const userName = account?.userName?.trim();
	if (!userName) return null;

	if (publication.platform === "csdn") {
		return `https://blog.csdn.net/${encodeURIComponent(userName)}/article/details/${encodeURIComponent(publishId)}`;
	}

	return `https://www.cnblogs.com/${encodeURIComponent(userName)}/articles/${encodeURIComponent(publishId)}`;
}

async function isKnownStablePublishedUrl(env: Env, publication: ArticlePublication, publishedUrl: string): Promise<boolean> {
	if (publication.status !== "published") return false;
	const knownUrl = await restoreKnownPublishedUrl(env, publication);
	if (!knownUrl) return false;
	return normalizeComparableUrl(knownUrl) === normalizeComparableUrl(publishedUrl);
}

function isPublicationLinkCheckFresh(
	state: PublicationLinkCheckState | null,
	publishedUrl: string,
	now: number,
): boolean {
	if (!state) return false;
	if (state.status === "invalid") return false;
	if (normalizeComparableUrl(state.publishedUrl) !== normalizeComparableUrl(publishedUrl)) return false;
	return now - state.checkedAt < publicationLinkCheckIntervalMs;
}

function resolvePublicationLinkCheckStatus(
	result: { valid: boolean; reason?: string },
): PublicationLinkCheckState["status"] {
	if (!result.valid) return "invalid";
	if (result.reason?.includes("unverified_keep")) return "unverified";
	return "valid";
}

interface ValidatePublicationLinksBody {
	force?: boolean;
	cleanupDuplicates?: boolean;
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function getPublicationLinkDedupeKey(publication: ArticlePublication, rawUrl: string): string {
	const articleScope = publication.articleId || "unknown-article";
	try {
		const parsed = new URL(rawUrl);
		const normalizedPath = parsed.pathname.replace(/\/+$/, "").toLowerCase();
		if (publication.platform === "website") {
			const slugMatch = normalizedPath.match(/\/blog\/([^/]+)/);
			if (slugMatch?.[1]) {
				return `${articleScope}:${publication.platform}:slug:${safeDecodeURIComponent(slugMatch[1]).toLowerCase()}`;
			}
		}
		return `${articleScope}:${publication.platform}:url:${parsed.origin.toLowerCase()}${normalizedPath}${parsed.search}`;
	} catch {
		return `${articleScope}:${publication.platform}:url:${normalizeComparableUrl(rawUrl).toLowerCase()}`;
	}
}

function getPublicationLatestTime(publication: ArticlePublication): number {
	return Math.max(publication.updatedAt ?? 0, publication.createdAt ?? 0, publication.completedAt ?? 0);
}

async function validatePublicationLinks(
	env: Env,
	publications: ArticlePublication[],
	options: { force: boolean; cleanupDuplicates: boolean },
): Promise<{
	removed: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	restored: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	skipped: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	deduplicated: Array<{ id: string; platform: PlatformType; publishedUrl: string; keptId: string; reason: string }>;
}> {
	const removed: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }> = [];
	const restored: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }> = [];
	const skipped: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }> = [];
	const deduplicated: Array<{ id: string; platform: PlatformType; publishedUrl: string; keptId: string; reason: string }> = [];
	const deduplicatedIds = new Set<string>();
	const now = Date.now();

	for (const publication of publications) {
		if (!publication.publishedUrl?.trim()) {
			const restoredUrl = await restoreKnownPublishedUrl(env, publication);
			if (!restoredUrl) continue;
			await updateArticlePublication(env.DB, publication.id, {
				publishedUrl: restoredUrl,
			});
			publication.publishedUrl = restoredUrl;
			restored.push({
				id: publication.id,
				platform: publication.platform,
				publishedUrl: restoredUrl,
				reason: "restored_from_publish_id",
			});
		}
	}

	if (options.cleanupDuplicates) {
		const seen = new Map<string, ArticlePublication>();
		const withLinks = publications
			.filter((publication) => Boolean(publication.publishedUrl?.trim()))
			.sort((a, b) => getPublicationLatestTime(b) - getPublicationLatestTime(a));

		for (const publication of withLinks) {
			const publishedUrl = publication.publishedUrl?.trim();
			if (!publishedUrl) continue;
			const key = getPublicationLinkDedupeKey(publication, publishedUrl);
			const existing = seen.get(key);
			if (!existing) {
				seen.set(key, publication);
				continue;
			}

			await updateArticlePublication(env.DB, publication.id, {
				publishedUrl: null,
			});
			deduplicatedIds.add(publication.id);
			deduplicated.push({
				id: publication.id,
				platform: publication.platform,
				publishedUrl,
				keptId: existing.id,
				reason: "duplicate_publication_url_keep_latest",
			});
		}
	}

	for (const publication of publications) {
		if (deduplicatedIds.has(publication.id)) continue;

		const publishedUrl = publication.publishedUrl?.trim();
		if (!publishedUrl) continue;

		const state = await getPublicationLinkCheckState(env, publication.id);
		if (!options.force && isPublicationLinkCheckFresh(state, publishedUrl, now)) {
			skipped.push({
				id: publication.id,
				platform: publication.platform,
				publishedUrl,
				reason: "checked_within_one_week",
			});
			continue;
		}

		if (!options.force && !state && await isKnownStablePublishedUrl(env, publication, publishedUrl)) {
			await setPublicationLinkCheckState(
				env,
				publication,
				publishedUrl,
				"skipped_initial",
				"stable_publish_id_url_initial_skip",
			);
			skipped.push({
				id: publication.id,
				platform: publication.platform,
				publishedUrl,
				reason: "stable_publish_id_url_initial_skip",
			});
			continue;
		}

		const result = await isPublicationUrlStillValid({
			...publication,
			publishedUrl,
		});
		await setPublicationLinkCheckState(
			env,
			publication,
			publishedUrl,
			resolvePublicationLinkCheckStatus(result),
			result.reason,
		);
		if (result.valid) continue;

		await updateArticlePublication(env.DB, publication.id, {
			publishedUrl: null,
		});
		removed.push({
			id: publication.id,
			platform: publication.platform,
			publishedUrl,
			reason: result.reason ?? "invalid",
		});
	}

	return { removed, restored, skipped, deduplicated };
}

app.post("/publications/validate-links", async (c) => {
	try {
		const publications = await listArticlePublications(c.env.DB);
		const result = await validatePublicationLinks(c.env, publications, {
			force: true,
			cleanupDuplicates: true,
		});
		const refreshed = await listArticlePublications(c.env.DB);
		return c.json({
			publications: refreshed,
			total: refreshed.length,
			...result,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "failed to validate all publication links";
		return c.json({ message }, 500);
	}
});

// Get article publications
app.get("/:id/publications", async (c) => {
	try {
		const publications = await getArticlePublicationsByArticleId(c.env.DB, c.req.param("id"));
		return c.json(publications);
	} catch (error) {
		const message = error instanceof Error ? error.message : "failed to get publications";
		return c.json({ message }, 500);
	}
});

app.post("/:id/publications/validate-links", async (c) => {
	try {
		const articleId = c.req.param("id");
		const body = await c.req.json().catch(() => ({})) as ValidatePublicationLinksBody;
		const force = body.force === true;
		const publications = await getArticlePublicationsByArticleId(c.env.DB, articleId);
		const result = await validatePublicationLinks(c.env, publications, {
			force,
			cleanupDuplicates: force || body.cleanupDuplicates === true,
		});
		const refreshed = await getArticlePublicationsByArticleId(c.env.DB, articleId);
		return c.json({ publications: refreshed, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "failed to validate publication links";
		return c.json({ message }, 500);
	}
});

export default app;
