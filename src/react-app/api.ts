import type {
	AIModelCatalog,
	AIModelSettings,
	AIModelRouteInput,
	AIModelRoutingConfig,
	AIProviderModelsResult,
	AIProviderProfileSummary,
	AIProviderTestResult,
	ArticleAISettings,
	Article,
	ArticleStatus,
	PlatformType,
	PromptKey,
	PromptTemplate,
	ProviderStatus,
	CreateAIProviderProfileInput,
	UpdateAIProviderProfileInput,
} from "./types";
import type {
	PublishTask,
	PublishTaskStep,
	ArticlePublication,
	AccountStatistics,
	CreatePublishTaskRequest,
	PublishTaskResponse,
	PublishTaskStatusResponse
} from "./types/publications";
import type { PlatformPublishSettingsMap, PublishablePlatformType } from "@/shared/types";
export type { PlatformType };

const jsonHeaders = {
	"Content-Type": "application/json",
};

export async function getArticle(id: string): Promise<Article> {
	return parseJson<Article>(await fetch(`/api/articles/${id}`));
}

export async function searchArticles(query: string): Promise<Article[]> {
	return parseJson<Article[]>(
		await fetch(`/api/articles/search?q=${encodeURIComponent(query)}`),
	);
}

async function parseJson<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!response.ok) {
		let message = text || `HTTP ${response.status}`;
		try {
			const payload = JSON.parse(text) as { message?: string; error?: string };
			message = payload.message || payload.error || message;
		} catch {
			const isHtml = response.headers.get("content-type")?.includes("text/html")
				|| /^\s*<!doctype html/i.test(text);
			if (isHtml) {
				const embeddedError = text.match(/const error = (\{[^\r\n]+\})/);
				if (embeddedError) {
					try {
						const payload = JSON.parse(embeddedError[1]) as { message?: string };
						message = payload.message || `HTTP ${response.status}`;
					} catch {
						message = `HTTP ${response.status}`;
					}
				} else {
					message = `HTTP ${response.status}`;
				}
			}
		}
		throw new Error(message);
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(text || "服务端返回了无效 JSON");
	}
}

export async function getArticles(): Promise<Article[]> {
	return parseJson<Article[]>(await fetch("/api/articles"));
}

export async function getJuejinTopTitles(): Promise<{ userTitles: string[]; juejinTitles: string[] }> {
	return parseJson<{ userTitles: string[]; juejinTitles: string[] }>(await fetch("/api/juejin/top"));
}

export async function generateTitle(): Promise<{ titles: string[]; count: number }> {
	return parseJson<{ titles: string[]; count: number }>(
		await fetch("/api/articles/generate-title", {
			method: "POST",
			headers: jsonHeaders,
		}),
	);
}

export async function generateContent(title: string): Promise<{ content: string }> {
	return parseJson<{ content: string }>(await fetch("/api/articles/generate-content", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify({ title }),
	}));
}

export interface GeneratedSummary {
	summary: string;
}

export interface GeneratedTags {
	tags: string[];
}

export async function generateArticleSummary(
	content: string,
	settings?: ArticleAISettings,
): Promise<GeneratedSummary> {
	return parseJson<GeneratedSummary>(
		await fetch(`/api/articles/generate-summary`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ content, settings }),
		}),
	);
}

export async function generateArticleTags(
	content: string,
	settings?: ArticleAISettings,
): Promise<GeneratedTags> {
	return parseJson<GeneratedTags>(
		await fetch(`/api/articles/generate-tags`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ content, settings }),
		}),
	);
}

export async function generateCover(title: string, content: string): Promise<{ coverImage: string }> {
	return parseJson<{ coverImage: string }>(
		await fetch(`/api/articles/generate-cover`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ title, content }),
		}),
	);
}

export async function createArticle(payload: Article): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function updateArticle(id: string, payload: Partial<Article>): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles/${id}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function deleteArticle(id: string): Promise<void> {
	const response = await fetch(`/api/articles/${id}`, {
		method: "DELETE",
		headers: jsonHeaders,
	});
	if (!response.ok) {
		throw new Error("删除文章失败");
	}
}

export async function transitionArticle(id: string, status: ArticleStatus): Promise<Article> {
	return parseJson<Article>(
		await fetch(`/api/articles/${id}/transition`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ status }),
		}),
	);
}

export async function getProviderStatus(): Promise<ProviderStatus> {
	return parseJson<ProviderStatus>(await fetch("/api/ai/status"));
}

export async function getAIModels(): Promise<AIModelCatalog> {
	return parseJson<AIModelCatalog>(await fetch("/api/ai/models"));
}

export async function getAIModelSettings(): Promise<AIModelSettings> {
	return parseJson<AIModelSettings>(await fetch("/api/ai/settings"));
}

export async function updateAIModelSettings(
	payload: Partial<AIModelSettings>,
): Promise<AIModelSettings> {
	return parseJson<AIModelSettings>(
		await fetch("/api/ai/settings", {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function getAIProviderProfiles(): Promise<AIProviderProfileSummary[]> {
	return parseJson<AIProviderProfileSummary[]>(await fetch("/api/ai/providers"));
}

export async function createAIProviderProfile(
	payload: CreateAIProviderProfileInput,
): Promise<AIProviderProfileSummary> {
	return parseJson<AIProviderProfileSummary>(await fetch("/api/ai/providers", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify(payload),
	}));
}

export async function updateAIProviderProfile(
	id: string,
	payload: UpdateAIProviderProfileInput,
): Promise<AIProviderProfileSummary> {
	return parseJson<AIProviderProfileSummary>(await fetch(`/api/ai/providers/${id}`, {
		method: "PUT",
		headers: jsonHeaders,
		body: JSON.stringify(payload),
	}));
}

export async function deleteAIProviderProfile(id: string): Promise<void> {
	await parseJson<{ success: true }>(await fetch(`/api/ai/providers/${id}`, { method: "DELETE" }));
}

export async function testUnsavedAIProviderProfile(
	payload: CreateAIProviderProfileInput,
): Promise<AIProviderTestResult> {
	return parseJson<AIProviderTestResult>(await fetch("/api/ai/providers/test", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify(payload),
	}));
}

export async function testAIProviderProfile(id: string): Promise<AIProviderTestResult> {
	return parseJson<AIProviderTestResult>(await fetch(`/api/ai/providers/${id}/test`, { method: "POST" }));
}

export async function getAIProviderModels(id: string): Promise<AIProviderModelsResult> {
	return parseJson<AIProviderModelsResult>(await fetch(`/api/ai/providers/${id}/models`));
}

export async function getAIModelRouting(): Promise<AIModelRoutingConfig> {
	return parseJson<AIModelRoutingConfig>(await fetch("/api/ai/routing"));
}

export async function updateAIModelRouting(routes: AIModelRouteInput[]): Promise<AIModelRoutingConfig> {
	return parseJson<AIModelRoutingConfig>(await fetch("/api/ai/routing", {
		method: "PUT",
		headers: jsonHeaders,
		body: JSON.stringify({ routes }),
	}));
}

export async function getPlatformPublishSettings(): Promise<PlatformPublishSettingsMap> {
	return parseJson<PlatformPublishSettingsMap>(await fetch("/api/settings/platform-publish"));
}

export async function updatePlatformPublishSettings(
	payload: Partial<PlatformPublishSettingsMap>,
): Promise<PlatformPublishSettingsMap> {
	return parseJson<PlatformPublishSettingsMap>(
		await fetch("/api/settings/platform-publish", {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function updatePlatformPublishSetting(
	platform: PublishablePlatformType,
	payload: Partial<PlatformPublishSettingsMap[PublishablePlatformType]>,
): Promise<PlatformPublishSettingsMap> {
	return parseJson<PlatformPublishSettingsMap>(
		await fetch(`/api/settings/platform-publish/${platform}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
	return parseJson<PromptTemplate[]>(await fetch("/api/ai/prompts"));
}

export async function updatePromptTemplate(key: PromptKey, template: string): Promise<PromptTemplate> {
	return parseJson<PromptTemplate>(
		await fetch(`/api/ai/prompts/${key}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify({ template }),
		}),
	);
}

export type PlatformAccount = {
	id: string;
	platform: PlatformType;
	userId?: string | null;
	userName?: string | null;
	avatar?: string | null;
	authToken?: string | null;
	description?: string | null;
	isActive: boolean;
	isVerified: boolean;
	lastVerifiedAt?: number | null;
	createdAt: number;
	updatedAt: number;
};

export type VerifyAccountResult = {
	valid: boolean;
	message: string;
	accountInfo?: {
		id: string;
		name: string;
		isLogin: boolean;
	};
};

export async function getPlatformAccounts(platform?: PlatformType): Promise<PlatformAccount[]> {
	const url = platform ? `/api/accounts?platform=${platform}` : "/api/accounts";
	return parseJson<PlatformAccount[]>(await fetch(url));
}

export async function getPlatformAccount(id: string): Promise<PlatformAccount> {
	return parseJson<PlatformAccount>(await fetch(`/api/accounts/${id}`));
}

export async function createPlatformAccount(payload: {
	platform: PlatformType;
	authToken?: string | null;
	appId?: string | null;
	appSecret?: string | null;
	baseUrl?: string | null;
	adminToken?: string | null;
	author?: string | null;
	description?: string;
}): Promise<PlatformAccount> {
	const response = await fetch("/api/accounts", {
		method: "POST",
		headers: jsonHeaders,
		body: JSON.stringify(payload),
	});
	return parseJson<PlatformAccount>(response);
}

export async function updatePlatformAccount(
	id: string,
	payload: (
		Partial<Omit<PlatformAccount, "id" | "platform" | "createdAt" | "updatedAt">>
		& {
			appId?: string | null;
			appSecret?: string | null;
			baseUrl?: string | null;
			adminToken?: string | null;
			author?: string | null;
		}
	),
): Promise<PlatformAccount> {
	return parseJson<PlatformAccount>(
		await fetch(`/api/accounts/${id}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function verifyPlatformAccount(id: string): Promise<VerifyAccountResult> {
	return parseJson<VerifyAccountResult>(
		await fetch(`/api/accounts/${id}/verify`, {
			method: "POST",
			headers: jsonHeaders,
		}),
	);
}

export async function deletePlatformAccount(id: string): Promise<void> {
	const response = await fetch(`/api/accounts/${id}`, {
		method: "DELETE",
		headers: jsonHeaders,
	});
	if (!response.ok) {
		throw new Error("删除平台账号失败");
	}
}

// ==================== 发布任务相关 API ====================

// 创建发布任务（支持批量发布与定时发布）
export async function createPublishTask(request: CreatePublishTaskRequest): Promise<PublishTaskResponse> {
	return parseJson<PublishTaskResponse>(
		await fetch("/api/publish/tasks", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(request),
		}),
	);
}

// 获取发布任务列表
export async function getPublishTasks(
	status?: PublishTask['status'],
	limit?: number,
	offset?: number,
): Promise<PublishTask[]> {
	const params = new URLSearchParams();
	if (status) params.append("status", status);
	if (limit) params.append("limit", limit.toString());
	if (offset) params.append("offset", offset.toString());

	const url = `/api/publish/tasks${params.toString() ? `?${params.toString()}` : ""}`;
	return parseJson<PublishTask[]>(await fetch(url));
}

// 获取单个发布任务详情
export async function getPublishTask(taskId: string, signal?: AbortSignal): Promise<PublishTaskStatusResponse> {
	return parseJson<PublishTaskStatusResponse>(await fetch(`/api/publish/tasks/${taskId}`, { signal }));
}

// 获取发布任务步骤列表
export async function getPublishTaskSteps(taskId: string): Promise<PublishTaskStep[]> {
	return parseJson<PublishTaskStep[]>(await fetch(`/api/publish/tasks/${taskId}/steps`));
}

export async function deletePublishTask(taskId: string): Promise<{ success: boolean; deleted: number }> {
	return parseJson<{ success: boolean; deleted: number }>(
		await fetch(`/api/publish/tasks/${taskId}`, {
			method: "DELETE",
			headers: jsonHeaders,
		}),
	);
}

export async function clearPublishTasks(status?: PublishTask['status']): Promise<{ success: boolean; deleted: number }> {
	const params = new URLSearchParams({ clear: "1" });
	if (status) params.set("status", status);
	return parseJson<{ success: boolean; deleted: number }>(
		await fetch(`/api/publish/tasks?${params.toString()}`, {
			method: "DELETE",
			headers: jsonHeaders,
		}),
	);
}

// 取消发布任务
export async function cancelPublishTask(taskId: string): Promise<{ success: boolean; message: string }> {
	return parseJson<{ success: boolean; message: string }>(
		await fetch(`/api/publish/tasks/${taskId}/cancel`, {
			method: "POST",
			headers: jsonHeaders,
		}),
	);
}

// 快速发布
export async function quickPublish(
	articleId: string,
	accountId: string,
	draftOnly: boolean = false,
	contentSlots?: CreatePublishTaskRequest["accountConfigs"][number]["contentSlots"],
): Promise<{ success: boolean; message: string; publicationId?: string }> {
	return parseJson<{ success: boolean; message: string; publicationId?: string }>(
		await fetch("/api/publish/quick", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ articleId, accountId, draftOnly, contentSlots }),
		}),
	);
}

// 获取文章发布记录
export async function getArticlePublications(articleId: string): Promise<ArticlePublication[]> {
	return parseJson<ArticlePublication[]>(await fetch(`/api/articles/${articleId}/publications`));
}

export async function validateArticlePublicationLinks(
	articleId: string,
	options?: { force?: boolean; cleanupDuplicates?: boolean },
): Promise<ArticlePublication[]> {
	const result = await parseJson<{ publications: ArticlePublication[] }>(
		await fetch(`/api/articles/${articleId}/publications/validate-links`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(options ?? {}),
		}),
	);
	return result.publications;
}

// 获取全部发布记录
export async function validateAllArticlePublicationLinks(): Promise<{
	publications: ArticlePublication[];
	total: number;
	removed: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	restored: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	skipped: Array<{ id: string; platform: PlatformType; publishedUrl: string; reason: string }>;
	deduplicated: Array<{ id: string; platform: PlatformType; publishedUrl: string; keptId: string; reason: string }>;
}> {
	return parseJson(
		await fetch("/api/articles/publications/validate-links", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({}),
		}),
	);
}

export async function getPublications(filters?: {
	articleId?: string;
	accountId?: string;
	platform?: PlatformType;
	status?: ArticlePublication['status'];
}): Promise<ArticlePublication[]> {
	const params = new URLSearchParams();
	if (filters?.articleId) params.append("articleId", filters.articleId);
	if (filters?.accountId) params.append("accountId", filters.accountId);
	if (filters?.platform) params.append("platform", filters.platform);
	if (filters?.status) params.append("status", filters.status);

	const url = `/api/publish/history${params.toString() ? `?${params.toString()}` : ""}`;
	return parseJson<ArticlePublication[]>(await fetch(url));
}

// 获取全部账号的发布统计
export async function getAccountStatistics(platform?: PlatformType): Promise<AccountStatistics[]> {
	const url = platform ? `/api/accounts/statistics?platform=${platform}` : "/api/accounts/statistics";
	return parseJson<AccountStatistics[]>(await fetch(url));
}

// 获取单个账号的发布统计
export async function getPlatformAccountStatistics(accountId: string): Promise<AccountStatistics> {
	return parseJson<AccountStatistics>(await fetch(`/api/accounts/${accountId}/statistics`));
}

// ==================== 个人网站 CMS API ====================

export type WebsitePost = {
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
};

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

export type WebsitePostListResult = {
	items: WebsitePost[];
	nextCursor: number | null;
	hasMore: boolean;
};

export type WebsiteSlugSettings = {
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
	systemPrompt: string;
};

export type WebsiteSource = "local" | "remote";

function appendWebsiteSource(params: URLSearchParams, source?: WebsiteSource) {
	if (source) params.set("source", source);
}

function websitePostUrl(slug: string, suffix = "", source?: WebsiteSource): string {
	const params = new URLSearchParams();
	appendWebsiteSource(params, source);
	const query = params.toString();
	return `/api/website/posts/${encodeURIComponent(slug)}${suffix}${query ? `?${query}` : ""}`;
}

async function unwrapApiData<T>(response: Promise<{ success: boolean; data: T; message?: string }>): Promise<T> {
	const payload = await response;
	if (!payload.success) {
		throw new Error(payload.message || "请求失败");
	}
	return payload.data;
}

export async function getWebsitePosts(filters?: {
	status?: "all" | "draft" | "published";
	limit?: number;
	cursor?: number;
	q?: string;
	tag?: string;
	accountId?: string;
	sortBy?: "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	source?: WebsiteSource;
}): Promise<WebsitePostListResult> {
	const params = new URLSearchParams();
	params.set("status", filters?.status ?? "all");
	params.set("limit", String(filters?.limit ?? 20));
	params.set("cursor", String(filters?.cursor ?? 0));
	if (filters?.q) params.set("q", filters.q);
	if (filters?.tag) params.set("tag", filters.tag);
	if (filters?.accountId) params.set("accountId", filters.accountId);
	if (filters?.sortBy) params.set("sortBy", filters.sortBy);
	if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);
	appendWebsiteSource(params, filters?.source);
	return unwrapApiData(parseJson<{ success: boolean; data: WebsitePostListResult; message?: string }>(
		await fetch(`/api/website/posts?${params.toString()}`),
	));
}

export async function getWebsitePost(slug: string, source?: WebsiteSource): Promise<WebsitePost> {
	return unwrapApiData(parseJson<{ success: boolean; data: WebsitePost; message?: string }>(
		await fetch(websitePostUrl(slug, "", source)),
	));
}

export async function createWebsitePost(payload: WebsitePostPayload, source?: WebsiteSource): Promise<{ slug: string; url?: string; publishedUrl?: string; draft: boolean }> {
	const params = new URLSearchParams();
	appendWebsiteSource(params, source);
	return unwrapApiData(parseJson<{ success: boolean; data: { slug: string; url?: string; publishedUrl?: string; draft: boolean }; message?: string }>(
		await fetch(`/api/website/posts${params.toString() ? `?${params.toString()}` : ""}`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	));
}

export async function updateWebsitePost(slug: string, payload: Partial<WebsitePostPayload>, source?: WebsiteSource): Promise<{ slug: string; url?: string; publishedUrl?: string; draft?: boolean }> {
	return unwrapApiData(parseJson<{ success: boolean; data: { slug: string; url?: string; publishedUrl?: string; draft?: boolean }; message?: string }>(
		await fetch(websitePostUrl(slug, "", source), {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	));
}

export async function deleteWebsitePost(slug: string, source?: WebsiteSource): Promise<void> {
	await unwrapApiData(parseJson<{ success: boolean; data: unknown; message?: string }>(
		await fetch(websitePostUrl(slug, "", source), {
			method: "DELETE",
			headers: jsonHeaders,
		}),
	));
}

export async function publishWebsitePost(slug: string, source?: WebsiteSource): Promise<{ slug: string; publishedUrl?: string; draft?: boolean }> {
	return unwrapApiData(parseJson<{ success: boolean; data: { slug: string; publishedUrl?: string; draft?: boolean }; message?: string }>(
		await fetch(websitePostUrl(slug, "/publish", source), {
			method: "POST",
			headers: jsonHeaders,
		}),
	));
}

export async function unpublishWebsitePost(slug: string, source?: WebsiteSource): Promise<{ slug: string; draft?: boolean }> {
	return unwrapApiData(parseJson<{ success: boolean; data: { slug: string; draft?: boolean }; message?: string }>(
		await fetch(websitePostUrl(slug, "/unpublish", source), {
			method: "POST",
			headers: jsonHeaders,
		}),
	));
}

export async function getWebsiteSlugSettings(): Promise<WebsiteSlugSettings> {
	return parseJson<WebsiteSlugSettings>(await fetch("/api/settings/website-slug"));
}

export async function updateWebsiteSlugSettings(payload: Partial<WebsiteSlugSettings>): Promise<WebsiteSlugSettings> {
	return parseJson<WebsiteSlugSettings>(
		await fetch("/api/settings/website-slug", {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}


