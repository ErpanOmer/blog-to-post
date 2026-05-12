import { marked } from "marked";
import { AbstractAccountService } from "@/worker/accounts/abstract";
import { registerAccountService } from "@/worker/accounts/index";
import type {
	AccountInfo,
	AccountStatus,
	Article,
	ArticleDraft,
	ArticlePublishResult,
	ImageUploadResult,
	VerifyResult,
} from "@/worker/accounts/index";
import type { Article as SharedArticle } from "@/shared/types";
import { applyHtmlContentSlots, applyMarkdownContentSlots } from "@/worker/utils/content-slots";
import type { Env } from "@/worker/types";
import { generateWebsiteSlug } from "@/worker/services/website-slug";
import { highlightHtmlPreCodeBlocksForAstroGithubDark } from "@/worker/utils/html-code-highlight";

export interface WebsiteCredential {
	baseUrl: string;
	adminToken: string;
	author?: string;
}

export interface WebsitePost {
	slug: string;
	title: string;
	description?: string;
	markdownContent?: string;
	htmlContent?: string;
	author?: string;
	cover?: string;
	tags: string[];
	draft: boolean;
	pubDate?: string;
	lastModified?: string;
	views?: number;
	likes?: number;
	url?: string;
	publishedUrl?: string;
	sourceArticleId?: string;
	createdAt?: number;
	updatedAt?: number;
	publishedAt?: number | null;
}

export interface WebsitePostListResult {
	items: WebsitePost[];
	nextCursor: number | null;
	hasMore: boolean;
}

type WebsiteApiResponse<T> = {
	success: boolean;
	data?: T;
	message?: string;
};

interface WebsiteHealthData {
	site?: string;
	database?: string;
	author?: string;
}

interface WebsitePostMutationResult {
	slug: string;
	draft: boolean;
	url?: string;
	publishedUrl?: string;
}

export type WebsitePostPayload = {
	sourceArticleId?: string;
	slug?: string;
	title: string;
	description?: string;
	markdownContent?: string;
	htmlContent?: string;
	pubDate?: string;
	lastModified?: string;
	author?: string;
	draft: boolean;
	tags?: string[];
	cover?: string;
};

const DEFAULT_WEBSITE_BASE_URL = "http://localhost:4321";
const DEFAULT_WEBSITE_AUTHOR = "ErpanOmer";

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

function normalizeBaseUrl(value: string | undefined): string {
	const raw = value?.trim() || DEFAULT_WEBSITE_BASE_URL;
	try {
		const parsed = new URL(raw);
		return trimTrailingSlash(parsed.toString());
	} catch {
		return trimTrailingSlash(DEFAULT_WEBSITE_BASE_URL);
	}
}

function normalizeTags(tags: SharedArticle["tags"]): string[] {
	const rawTags = tags as unknown;
	if (Array.isArray(rawTags)) {
		return [...new Set(rawTags.map((tag) => String(tag).trim()).filter(Boolean))];
	}
	if (typeof rawTags === "string") {
		return [...new Set(rawTags.split(/[,，、|]/).map((tag) => tag.trim()).filter(Boolean))];
	}
	return [];
}

function todayDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

function pickString(record: Record<string, unknown> | null, key: string): string | undefined {
	const value = record?.[key];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function normalizeSlug(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function isGeneratedFallbackSlug(slug: string): boolean {
	return /^post-\d+$/.test(slug);
}

export default class WebsiteAccountService extends AbstractAccountService {
	constructor(authToken: string, env?: Env) {
		super("website", authToken, env);
	}

	protected buildHeaders(): Record<string, string> {
		const credential = this.parseCredential();
		return {
			accept: "application/json",
			authorization: `Bearer ${credential.adminToken}`,
		};
	}

	private parseCredential(): WebsiteCredential {
		const raw = this.authToken?.trim() ?? "";
		if (!raw) {
			return {
				baseUrl: DEFAULT_WEBSITE_BASE_URL,
				adminToken: "",
				author: DEFAULT_WEBSITE_AUTHOR,
			};
		}

		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const baseUrl = pickString(parsed, "baseUrl") ?? pickString(parsed, "siteUrl");
			const adminToken = pickString(parsed, "adminToken")
				?? pickString(parsed, "token")
				?? pickString(parsed, "websiteAdminToken")
				?? "";
			const author = pickString(parsed, "author") ?? DEFAULT_WEBSITE_AUTHOR;
			return {
				baseUrl: normalizeBaseUrl(baseUrl),
				adminToken,
				author,
			};
		} catch {
			return {
				baseUrl: DEFAULT_WEBSITE_BASE_URL,
				adminToken: raw,
				author: DEFAULT_WEBSITE_AUTHOR,
			};
		}
	}

	private buildUrl(path: string): string {
		const credential = this.parseCredential();
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		return `${credential.baseUrl}${normalizedPath}`;
	}

	private async requestWebsite<T>(path: string, options: RequestInit = {}): Promise<T> {
		const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
		if (options.body && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
			headers["Content-Type"] = "application/json";
		}

		const response = await this.request<WebsiteApiResponse<T>>(this.buildUrl(path), {
			...options,
			headers,
		});

		if (!response || typeof response !== "object") {
			throw new Error("Website API returned invalid response");
		}
		if (!response.success) {
			throw new Error(response.message || "Website API request failed");
		}
		return response.data as T;
	}

	private async buildPostPayload(article: SharedArticle, draft: boolean): Promise<WebsitePostPayload> {
		const markdownContent = applyMarkdownContentSlots(article.content?.trim() ?? "", article);
		const rawHtml = article.htmlContent?.trim()
			? article.htmlContent.trim()
			: String(await marked.parse(markdownContent));
		const htmlContent = applyHtmlContentSlots(rawHtml, article);
		const credential = this.parseCredential();
		const nowIso = new Date().toISOString();
		const slug = await this.generateRequiredSlug(article);

		return {
			sourceArticleId: article.id,
			slug,
			title: article.title.trim(),
			description: article.summary?.trim() || article.title.trim(),
			markdownContent,
			htmlContent: highlightHtmlPreCodeBlocksForAstroGithubDark(htmlContent),
			pubDate: todayDateString(),
			lastModified: nowIso,
			author: credential.author || DEFAULT_WEBSITE_AUTHOR,
			draft,
			tags: normalizeTags(article.tags),
			cover: article.coverImage?.trim() || undefined,
		};
	}

	private preparePostPayloadForApi<T extends Partial<WebsitePostPayload>>(payload: T): T {
		const htmlContent = payload.htmlContent;
		if (typeof htmlContent !== "string" || !htmlContent.trim()) {
			return payload;
		}
		return {
			...payload,
			htmlContent: highlightHtmlPreCodeBlocksForAstroGithubDark(htmlContent),
		};
	}

	private async generateRequiredSlug(article: SharedArticle): Promise<string> {
		if (!this.env) {
			throw new Error("Website slug generation requires worker runtime env");
		}

		await this.tracePublish({
			stage: "website_slug_generate_start",
			message: "Start generating website SEO slug",
			metadata: {
				title: article.title,
			},
		});

		const slug = await generateWebsiteSlug(this.env, {
			title: article.title,
			description: article.summary,
			content: article.content,
			tags: normalizeTags(article.tags),
		}, { allowFallback: false });

		await this.tracePublish({
			stage: "website_slug_generate_done",
			message: "Website SEO slug generated",
			metadata: { slug },
		});

		return slug;
	}

	private normalizePostMutation(data: WebsitePostMutationResult | null | undefined, fallbackTitle: string): ArticleDraft {
		const slug = data?.slug?.trim();
		if (!slug) {
			throw new Error("Website API response missing slug");
		}
		return {
			id: slug,
			title: fallbackTitle,
			content: "",
			createdAt: Date.now(),
			url: data?.url || data?.publishedUrl || this.buildUrl(`/blog/${slug}`),
		};
	}

	private async requestPostCreate(payload: WebsitePostPayload): Promise<WebsitePostMutationResult> {
		return await this.requestWebsite<WebsitePostMutationResult>("/api/admin/posts", {
			method: "POST",
			body: JSON.stringify(this.preparePostPayloadForApi(payload)),
		});
	}

	private async requestPostCreateWithSlugGuard(payload: WebsitePostPayload): Promise<WebsitePostMutationResult> {
		const expectedSlug = normalizeSlug(payload.slug);
		const data = await this.requestPostCreate(payload);
		const actualSlug = normalizeSlug(data?.slug);

		if (!expectedSlug || actualSlug === expectedSlug) {
			return data;
		}

		await this.tracePublish({
			stage: "website_article_slug_mismatch",
			level: "warn",
			message: "Website API returned a different slug than requested",
			metadata: {
				expectedSlug,
				actualSlug,
				sourceArticleId: payload.sourceArticleId ?? null,
			},
		});

		if (!payload.sourceArticleId || !actualSlug || !isGeneratedFallbackSlug(actualSlug)) {
			throw new Error(`Website API returned unexpected slug "${actualSlug}" instead of "${expectedSlug}"`);
		}

		await this.tracePublish({
			stage: "website_article_slug_mismatch_cleanup_start",
			level: "warn",
			message: "Deleting fallback slug and retrying website post creation",
			metadata: {
				expectedSlug,
				actualSlug,
			},
		});

		await this.articleDelete(actualSlug);

		const retryData = await this.requestPostCreate(payload);
		const retrySlug = normalizeSlug(retryData?.slug);
		if (retrySlug !== expectedSlug) {
			throw new Error(`Website API returned unexpected slug "${retrySlug}" instead of "${expectedSlug}" after retry`);
		}

		await this.tracePublish({
			stage: "website_article_slug_mismatch_cleanup_done",
			message: "Website post recreated with requested slug",
			metadata: {
				slug: retrySlug,
			},
		});

		return retryData;
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "Website account verified successfully",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "Website account verification failed",
			};
		}
	}

	async status(): Promise<AccountStatus> {
		const result = await this.verify();
		return {
			isActive: result.valid,
			isVerified: result.valid,
			lastVerifiedAt: Date.now(),
			message: result.message,
		};
	}

	async info(): Promise<AccountInfo> {
		const credential = this.parseCredential();
		if (!credential.adminToken) {
			throw new Error("Website admin token is required");
		}

		const health = await this.requestWebsite<WebsiteHealthData>("/api/admin/health", {
			method: "GET",
		});
		const site = health?.site?.trim() || credential.baseUrl;
		const author = health?.author?.trim() || credential.author || DEFAULT_WEBSITE_AUTHOR;
		let id = site;
		try {
			id = new URL(credential.baseUrl).host;
		} catch {
			// keep API-provided site fallback
		}

		return {
			id,
			name: `${author} @ ${site}`,
			isLogin: true,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		await this.tracePublish({
			stage: "website_article_draft_start",
			message: "Start creating website draft",
			metadata: {
				titleLength: article.title.length,
				contentLength: article.content.length,
			},
		});

		const payload = await this.buildPostPayload(article, true);
		const data = await this.requestPostCreateWithSlugGuard(payload);
		const draft = this.normalizePostMutation(data, article.title);

		await this.tracePublish({
			stage: "website_article_draft_done",
			message: "Website draft created",
			metadata: {
				draftId: draft.id,
				draftUrl: draft.url,
			},
		});

		return {
			...draft,
			content: payload.markdownContent ?? "",
			htmlContent: payload.htmlContent,
		};
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		try {
			const draftId = article.draftId?.trim();
			await this.tracePublish({
				stage: "website_article_publish_start",
				message: "Start publishing website article",
				metadata: { draftId: draftId ?? null },
			});

			let data: WebsitePostMutationResult;
			if (draftId) {
				data = await this.requestWebsite<WebsitePostMutationResult>(
					`/api/admin/posts/${encodeURIComponent(draftId)}/publish`,
					{ method: "POST", body: JSON.stringify({}) },
				);
			} else {
				const payload = await this.buildPostPayload(article, false);
				data = await this.requestPostCreateWithSlugGuard(payload);
			}

			const slug = data.slug;
			const url = data.publishedUrl || data.url || this.buildUrl(`/blog/${slug}`);
			await this.tracePublish({
				stage: "website_article_publish_done",
				message: "Website article published",
				metadata: {
					publishId: slug,
					publishedUrl: url,
				},
			});

			return {
				success: true,
				articleId: slug,
				message: "Website article published",
				url,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "website_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Website publish failed",
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "Website publish failed",
			};
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		await this.requestWebsite<unknown>(`/api/admin/posts/${encodeURIComponent(articleId)}`, {
			method: "DELETE",
		});
		return { success: true, message: "Website article deleted" };
	}

	async articleList(page = 1, pageSize = 20): Promise<Article[]> {
		const cursor = Math.max(0, page - 1) * pageSize;
		const result = await this.websitePostList({ cursor, limit: pageSize, status: "all" });
		return result.items.map((post) => ({
			id: post.slug,
			title: post.title,
			content: post.markdownContent ?? "",
			publishedAt: post.publishedAt ?? undefined,
			status: post.draft ? "draft" : "published",
		}));
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		const post = await this.websitePostDetail(articleId);
		if (!post) return null;
		return {
			id: post.slug,
			title: post.title,
			content: post.markdownContent ?? "",
			publishedAt: post.publishedAt ?? undefined,
			status: post.draft ? "draft" : "published",
		};
	}

	async articleTags(articleId: string): Promise<string[]> {
		const post = await this.websitePostDetail(articleId);
		return post?.tags ?? [];
	}

	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		void filename;
		return {
			success: true,
			url: imageData,
			message: "Website keeps original image URL",
		};
	}

	async websitePostList(options: {
		status?: "all" | "draft" | "published";
		limit?: number;
		cursor?: number;
		q?: string;
		tag?: string;
		includeDeleted?: boolean;
		sortBy?: "createdAt" | "updatedAt";
		sortOrder?: "asc" | "desc";
	} = {}): Promise<WebsitePostListResult> {
		const params = new URLSearchParams();
		params.set("status", options.status ?? "all");
		params.set("limit", String(options.limit ?? 20));
		params.set("cursor", String(options.cursor ?? 0));
		if (options.q?.trim()) params.set("q", options.q.trim());
		if (options.tag?.trim()) params.set("tag", options.tag.trim());
		if (options.includeDeleted) params.set("includeDeleted", "true");
		if (options.sortBy) params.set("sortBy", options.sortBy);
		if (options.sortOrder) params.set("sortOrder", options.sortOrder);

		return await this.requestWebsite<WebsitePostListResult>(`/api/admin/posts?${params.toString()}`, {
			method: "GET",
		});
	}

	async websitePostDetail(slug: string): Promise<WebsitePost | null> {
		try {
			return await this.requestWebsite<WebsitePost>(`/api/admin/posts/${encodeURIComponent(slug)}`, {
				method: "GET",
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("404") || message.toLowerCase().includes("not found")) {
				return null;
			}
			throw error;
		}
	}

	async websitePostCreate(payload: WebsitePostPayload): Promise<WebsitePostMutationResult> {
		return await this.requestPostCreateWithSlugGuard(payload);
	}

	async websitePostUpdate(slug: string, payload: Partial<WebsitePostPayload>): Promise<WebsitePostMutationResult> {
		return await this.requestWebsite<WebsitePostMutationResult>(`/api/admin/posts/${encodeURIComponent(slug)}`, {
			method: "PUT",
			body: JSON.stringify(this.preparePostPayloadForApi(payload)),
		});
	}

	async websitePostPublish(slug: string): Promise<WebsitePostMutationResult> {
		return await this.requestWebsite<WebsitePostMutationResult>(`/api/admin/posts/${encodeURIComponent(slug)}/publish`, {
			method: "POST",
			body: JSON.stringify({}),
		});
	}

	async websitePostUnpublish(slug: string): Promise<WebsitePostMutationResult> {
		return await this.requestWebsite<WebsitePostMutationResult>(`/api/admin/posts/${encodeURIComponent(slug)}/unpublish`, {
			method: "POST",
			body: JSON.stringify({}),
		});
	}
}

registerAccountService("website", WebsiteAccountService);
