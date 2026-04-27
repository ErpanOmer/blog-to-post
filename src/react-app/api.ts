import type {
	AIModelCatalog,
	AIModelSettings,
	ArticleAISettings,
	Article,
	ArticleStatus,
	PlatformType,
	PromptKey,
	PromptTemplate,
	ProviderStatus,
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
		throw new Error(text || `HTTP ${response.status}`);
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
	const response = await fetch("/api/articles/generate-content", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title }),
	});

	if (!response.ok) throw new Error("生成正文失败");

	const data = await response.json() as { content: string };

	return data;
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
export async function getPublishTasks(status?: PublishTask['status'], limit?: number): Promise<PublishTask[]> {
	const params = new URLSearchParams();
	if (status) params.append("status", status);
	if (limit) params.append("limit", limit.toString());

	const url = `/api/publish/tasks${params.toString() ? `?${params.toString()}` : ""}`;
	return parseJson<PublishTask[]>(await fetch(url));
}

// 获取单个发布任务详情
export async function getPublishTask(taskId: string): Promise<PublishTaskStatusResponse> {
	return parseJson<PublishTaskStatusResponse>(await fetch(`/api/publish/tasks/${taskId}`));
}

// 获取发布任务步骤列表
export async function getPublishTaskSteps(taskId: string): Promise<PublishTaskStep[]> {
	return parseJson<PublishTaskStep[]>(await fetch(`/api/publish/tasks/${taskId}/steps`));
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

export async function validateArticlePublicationLinks(articleId: string): Promise<ArticlePublication[]> {
	const result = await parseJson<{ publications: ArticlePublication[] }>(
		await fetch(`/api/articles/${articleId}/publications/validate-links`, {
			method: "POST",
			headers: jsonHeaders,
		}),
	);
	return result.publications;
}

// 获取全部发布记录
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


