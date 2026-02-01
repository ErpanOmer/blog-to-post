import type { Article, ArticleStatus, PlatformType, PromptKey, PromptTemplate, ProviderStatus } from "./types";
import type { 
  PublishTask, 
  PublishTaskStep, 
  AccountConfig,
  ArticlePublication,
  AccountStatistics,
  CreatePublishTaskRequest,
  PublishTaskResponse,
  PublishTaskStatusResponse
} from "./types/publications";
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
	} catch (error) {
		throw new Error(text || "Invalid JSON response");
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
	
	if (!response.ok) throw new Error("Generate content failed");

	const data = await response.json() as { content: string };

	console.log('Generated content:', data);

	return data;
}

// 文章摘要数据结构
export interface ArticleSummary {
	summary: string;
	tags: string[];
}

export async function generateSummary(content: string): Promise<ArticleSummary> {
	return parseJson<ArticleSummary>(
		await fetch(`/api/articles/generate-summary`, {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ content }),
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

export async function distributeArticle(id: string, platforms: PlatformType[]): Promise<{ article: Article }> {
	return parseJson<{ article: Article }>(
		await fetch("/api/distribute", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ id, platforms }),
		}),
	);
}

export async function getProviderStatus(): Promise<ProviderStatus> {
	return parseJson<ProviderStatus>(await fetch("/api/ai/status"));
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
	return parseJson<PromptTemplate[]>(await fetch("/api/prompts"));
}

export async function updatePromptTemplate(key: PromptKey, template: string): Promise<PromptTemplate> {
	return parseJson<PromptTemplate>(
		await fetch(`/api/prompts/${key}`, {
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
	const url = platform ? `/api/platform-accounts?platform=${platform}` : "/api/platform-accounts";
	return parseJson<PlatformAccount[]>(await fetch(url));
}

export async function getPlatformAccount(id: string): Promise<PlatformAccount> {
	return parseJson<PlatformAccount>(await fetch(`/api/platform-accounts/${id}`));
}

export async function createPlatformAccount(payload: {
	platform: PlatformType;
	authToken?: string;
	description?: string;
}): Promise<PlatformAccount> {
	return parseJson<PlatformAccount>(
		await fetch("/api/platform-accounts", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function updatePlatformAccount(
	id: string,
	payload: Partial<Omit<PlatformAccount, "id" | "platform" | "createdAt" | "updatedAt">>,
): Promise<PlatformAccount> {
	return parseJson<PlatformAccount>(
		await fetch(`/api/platform-accounts/${id}`, {
			method: "PUT",
			headers: jsonHeaders,
			body: JSON.stringify(payload),
		}),
	);
}

export async function verifyPlatformAccount(id: string): Promise<VerifyAccountResult> {
	return parseJson<VerifyAccountResult>(
		await fetch(`/api/platform-accounts/${id}/verify`, {
			method: "POST",
			headers: jsonHeaders,
		}),
	);
}

export async function deletePlatformAccount(id: string): Promise<void> {
	const response = await fetch(`/api/platform-accounts/${id}`, {
		method: "DELETE",
		headers: jsonHeaders,
	});
	if (!response.ok) {
		throw new Error("删除平台帐号失败");
	}
}

// ==================== 发布相关 API ====================

// 创建发布任务（支持批量发布和定时发布）
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
	draftOnly: boolean = false
): Promise<{ success: boolean; message: string; publicationId?: string }> {
	return parseJson<{ success: boolean; message: string; publicationId?: string }>(
		await fetch("/api/publish/quick", {
			method: "POST",
			headers: jsonHeaders,
			body: JSON.stringify({ articleId, accountId, draftOnly }),
		}),
	);
}

// 获取文章的发布记录
export async function getArticlePublications(articleId: string): Promise<ArticlePublication[]> {
	return parseJson<ArticlePublication[]>(await fetch(`/api/articles/${articleId}/publications`));
}

// 获取所有发布记录
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
	
	const url = `/api/publications${params.toString() ? `?${params.toString()}` : ""}`;
	return parseJson<ArticlePublication[]>(await fetch(url));
}

// 获取所有账号的发布统计
export async function getAccountStatistics(platform?: PlatformType): Promise<AccountStatistics[]> {
	const url = platform ? `/api/account-statistics?platform=${platform}` : "/api/account-statistics";
	return parseJson<AccountStatistics[]>(await fetch(url));
}

// 获取单个账号的发布统计
export async function getPlatformAccountStatistics(accountId: string): Promise<AccountStatistics> {
	return parseJson<AccountStatistics>(await fetch(`/api/platform-accounts/${accountId}/statistics`));
}
