import type { 
  ArticlePublication, 
  PublishTask, 
  PublishTaskStep, 
  AccountStatistics,
  PublicationStatus,
  PublishTaskStatus,
  PublishStepStatus,
  PublishType,
  PublishTaskType,
  AccountConfig,
  PublishStepType
} from "../types/publications";
import type { PlatformType } from "../types";

// ==================== Article Publication Operations ====================

export async function createArticlePublication(
  db: D1Database,
  payload: {
    id: string;
    articleId: string;
    accountId: string;
    platform: PlatformType;
    publishType: PublishType;
    status?: PublicationStatus;
    startedAt?: number;
  }
): Promise<ArticlePublication> {
  const now = Date.now();
  const publication: ArticlePublication = {
    ...payload,
    status: payload.status ?? "pending",
    startedAt: payload.startedAt ?? now,
    draftId: null,
    publishedUrl: null,
    errorMessage: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.prepare(
    `INSERT INTO article_publications 
     (id, articleId, accountId, platform, status, publishType, draftId, publishedUrl, errorMessage, startedAt, completedAt, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    publication.id,
    publication.articleId,
    publication.accountId,
    publication.platform,
    publication.status,
    publication.publishType,
    publication.draftId,
    publication.publishedUrl,
    publication.errorMessage,
    publication.startedAt,
    publication.completedAt,
    publication.createdAt,
    publication.updatedAt
  ).run();

  return publication;
}

export async function updateArticlePublication(
  db: D1Database,
  id: string,
  updates: Partial<Pick<ArticlePublication, "status" | "draftId" | "publishedUrl" | "errorMessage" | "completedAt">>
): Promise<ArticlePublication | null> {
  const current = await getArticlePublication(db, id);
  if (!current) return null;

  const now = Date.now();
  const next = {
    ...current,
    ...updates,
    updatedAt: now,
  };

  await db.prepare(
    `UPDATE article_publications 
     SET status = ?, draftId = ?, publishedUrl = ?, errorMessage = ?, completedAt = ?, updatedAt = ? 
     WHERE id = ?`
  ).bind(
    next.status,
    next.draftId,
    next.publishedUrl,
    next.errorMessage,
    next.completedAt,
    next.updatedAt,
    id
  ).run();

  return next;
}

export async function getArticlePublication(db: D1Database, id: string): Promise<ArticlePublication | null> {
  const result = await db.prepare(
    "SELECT * FROM article_publications WHERE id = ?"
  ).bind(id).first<ArticlePublication>();
  
  return result ?? null;
}

export async function listArticlePublications(
  db: D1Database,
  filters?: { articleId?: string; accountId?: string; platform?: PlatformType; status?: PublicationStatus }
): Promise<ArticlePublication[]> {
  let query = "SELECT * FROM article_publications WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.articleId) {
    query += " AND articleId = ?";
    params.push(filters.articleId);
  }
  if (filters?.accountId) {
    query += " AND accountId = ?";
    params.push(filters.accountId);
  }
  if (filters?.platform) {
    query += " AND platform = ?";
    params.push(filters.platform);
  }
  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  query += " ORDER BY createdAt DESC";

  const result = await db.prepare(query).bind(...params).all<ArticlePublication>();
  return result.results ?? [];
}

export async function getArticlePublicationsByArticleId(
  db: D1Database, 
  articleId: string
): Promise<ArticlePublication[]> {
  return listArticlePublications(db, { articleId });
}

export async function deleteArticlePublication(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM article_publications WHERE id = ?").bind(id).run();
  return result.success;
}

// ==================== Publish Task Operations ====================

export async function createPublishTask(
  db: D1Database,
  payload: {
    id: string;
    type: PublishTaskType;
    articleIds: string[];
    accountConfigs: AccountConfig[];
    scheduleTime?: number | null;
  }
): Promise<PublishTask> {
  const now = Date.now();
  const totalSteps = payload.articleIds.length * payload.accountConfigs.length * 3; // 3 steps per article-account pair
  
  const task: PublishTask = {
    ...payload,
    status: payload.scheduleTime && payload.scheduleTime > now ? "pending" : "pending",
    currentStep: 0,
    totalSteps,
    progressData: null,
    resultData: null,
    errorData: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.prepare(
    `INSERT INTO publish_tasks 
     (id, type, status, articleIds, accountConfigs, scheduleTime, currentStep, totalSteps, progressData, resultData, errorData, createdAt, startedAt, completedAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    task.id,
    task.type,
    task.status,
    JSON.stringify(task.articleIds),
    JSON.stringify(task.accountConfigs),
    task.scheduleTime ?? null,
    task.currentStep,
    task.totalSteps,
    task.progressData ? JSON.stringify(task.progressData) : null,
    task.resultData ? JSON.stringify(task.resultData) : null,
    task.errorData ? JSON.stringify(task.errorData) : null,
    task.createdAt,
    task.startedAt,
    task.completedAt,
    task.updatedAt
  ).run();

  return task;
}

export async function getPublishTask(db: D1Database, id: string): Promise<PublishTask | null> {
  const result = await db.prepare("SELECT * FROM publish_tasks WHERE id = ?").bind(id).first<{
    id: string;
    type: PublishTaskType;
    status: PublishTaskStatus;
    articleIds: string;
    accountConfigs: string;
    scheduleTime: number | null;
    currentStep: number;
    totalSteps: number;
    progressData: string | null;
    resultData: string | null;
    errorData: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    updatedAt: number;
  }>();

  if (!result) return null;

  return {
    ...result,
    articleIds: JSON.parse(result.articleIds),
    accountConfigs: JSON.parse(result.accountConfigs),
    progressData: result.progressData ? JSON.parse(result.progressData) : null,
    resultData: result.resultData ? JSON.parse(result.resultData) : null,
    errorData: result.errorData ? JSON.parse(result.errorData) : null,
  };
}

export async function updatePublishTask(
  db: D1Database,
  id: string,
  updates: Partial<Pick<PublishTask, "status" | "currentStep" | "progressData" | "resultData" | "errorData" | "startedAt" | "completedAt">>
): Promise<PublishTask | null> {
  const current = await getPublishTask(db, id);
  if (!current) return null;

  const now = Date.now();
  const next = {
    ...current,
    ...updates,
    updatedAt: now,
  };

  await db.prepare(
    `UPDATE publish_tasks 
     SET status = ?, currentStep = ?, progressData = ?, resultData = ?, errorData = ?, startedAt = ?, completedAt = ?, updatedAt = ? 
     WHERE id = ?`
  ).bind(
    next.status,
    next.currentStep,
    next.progressData ? JSON.stringify(next.progressData) : null,
    next.resultData ? JSON.stringify(next.resultData) : null,
    next.errorData ? JSON.stringify(next.errorData) : null,
    next.startedAt,
    next.completedAt,
    next.updatedAt,
    id
  ).run();

  return next;
}

export async function listPublishTasks(
  db: D1Database,
  filters?: { status?: PublishTaskStatus; limit?: number }
): Promise<PublishTask[]> {
  let query = "SELECT * FROM publish_tasks WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  query += " ORDER BY createdAt DESC";

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  const result = await db.prepare(query).bind(...params).all<{
    id: string;
    type: PublishTaskType;
    status: PublishTaskStatus;
    articleIds: string;
    accountConfigs: string;
    scheduleTime: number | null;
    currentStep: number;
    totalSteps: number;
    progressData: string | null;
    resultData: string | null;
    errorData: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    updatedAt: number;
  }>();

  return (result.results ?? []).map(row => ({
    ...row,
    articleIds: JSON.parse(row.articleIds),
    accountConfigs: JSON.parse(row.accountConfigs),
    progressData: row.progressData ? JSON.parse(row.progressData) : null,
    resultData: row.resultData ? JSON.parse(row.resultData) : null,
    errorData: row.errorData ? JSON.parse(row.errorData) : null,
  }));
}

export async function getPendingScheduledTasks(db: D1Database): Promise<PublishTask[]> {
  const now = Date.now();
  const result = await db.prepare(
    `SELECT * FROM publish_tasks 
     WHERE status = 'pending' AND scheduleTime IS NOT NULL AND scheduleTime <= ? 
     ORDER BY scheduleTime ASC`
  ).bind(now).all<{
    id: string;
    type: PublishTaskType;
    status: PublishTaskStatus;
    articleIds: string;
    accountConfigs: string;
    scheduleTime: number | null;
    currentStep: number;
    totalSteps: number;
    progressData: string | null;
    resultData: string | null;
    errorData: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    updatedAt: number;
  }>();

  return (result.results ?? []).map(row => ({
    ...row,
    articleIds: JSON.parse(row.articleIds),
    accountConfigs: JSON.parse(row.accountConfigs),
    progressData: row.progressData ? JSON.parse(row.progressData) : null,
    resultData: row.resultData ? JSON.parse(row.resultData) : null,
    errorData: row.errorData ? JSON.parse(row.errorData) : null,
  }));
}

export async function deletePublishTask(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM publish_tasks WHERE id = ?").bind(id).run();
  return result.success;
}

// ==================== Publish Task Step Operations ====================

export async function createPublishTaskStep(
  db: D1Database,
  payload: {
    id: string;
    taskId: string;
    stepNumber: number;
    articleId?: string | null;
    accountId?: string | null;
    platform: PlatformType;
    stepType: PublishStepType;
    inputData?: Record<string, unknown> | null;
  }
): Promise<PublishTaskStep> {
  const now = Date.now();
  const step: PublishTaskStep = {
    ...payload,
    status: "pending",
    startTime: null,
    endTime: null,
    duration: null,
    outputData: null,
    errorMessage: null,
    retryCount: 0,
    createdAt: now,
  };

  await db.prepare(
    `INSERT INTO publish_task_steps 
     (id, taskId, stepNumber, articleId, accountId, platform, stepType, status, startTime, endTime, duration, inputData, outputData, errorMessage, retryCount, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    step.id,
    step.taskId,
    step.stepNumber,
    step.articleId ?? null,
    step.accountId ?? null,
    step.platform,
    step.stepType,
    step.status,
    step.startTime,
    step.endTime,
    step.duration,
    step.inputData ? JSON.stringify(step.inputData) : null,
    step.outputData ? JSON.stringify(step.outputData) : null,
    step.errorMessage,
    step.retryCount,
    step.createdAt
  ).run();

  return step;
}

export async function updatePublishTaskStep(
  db: D1Database,
  id: string,
  updates: Partial<Pick<PublishTaskStep, "status" | "startTime" | "endTime" | "duration" | "outputData" | "errorMessage" | "retryCount">>
): Promise<PublishTaskStep | null> {
  const current = await getPublishTaskStep(db, id);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
  };

  await db.prepare(
    `UPDATE publish_task_steps 
     SET status = ?, startTime = ?, endTime = ?, duration = ?, outputData = ?, errorMessage = ?, retryCount = ? 
     WHERE id = ?`
  ).bind(
    next.status,
    next.startTime,
    next.endTime,
    next.duration,
    next.outputData ? JSON.stringify(next.outputData) : null,
    next.errorMessage,
    next.retryCount,
    id
  ).run();

  return next;
}

export async function getPublishTaskStep(db: D1Database, id: string): Promise<PublishTaskStep | null> {
  const result = await db.prepare("SELECT * FROM publish_task_steps WHERE id = ?").bind(id).first<{
    id: string;
    taskId: string;
    stepNumber: number;
    articleId: string | null;
    accountId: string | null;
    platform: PlatformType;
    stepType: PublishStepType;
    status: PublishStepStatus;
    startTime: number | null;
    endTime: number | null;
    duration: number | null;
    inputData: string | null;
    outputData: string | null;
    errorMessage: string | null;
    retryCount: number;
    createdAt: number;
  }>();

  if (!result) return null;

  return {
    ...result,
    inputData: result.inputData ? JSON.parse(result.inputData) : null,
    outputData: result.outputData ? JSON.parse(result.outputData) : null,
  };
}

export async function listPublishTaskSteps(
  db: D1Database,
  taskId: string
): Promise<PublishTaskStep[]> {
  const result = await db.prepare(
    "SELECT * FROM publish_task_steps WHERE taskId = ? ORDER BY stepNumber ASC"
  ).bind(taskId).all<{
    id: string;
    taskId: string;
    stepNumber: number;
    articleId: string | null;
    accountId: string | null;
    platform: PlatformType;
    stepType: PublishStepType;
    status: PublishStepStatus;
    startTime: number | null;
    endTime: number | null;
    duration: number | null;
    inputData: string | null;
    outputData: string | null;
    errorMessage: string | null;
    retryCount: number;
    createdAt: number;
  }>();

  return (result.results ?? []).map(row => ({
    ...row,
    inputData: row.inputData ? JSON.parse(row.inputData) : null,
    outputData: row.outputData ? JSON.parse(row.outputData) : null,
  }));
}

// ==================== Account Statistics Operations ====================

export async function getAccountStatistics(db: D1Database, accountId: string): Promise<AccountStatistics | null> {
  const result = await db.prepare("SELECT * FROM account_statistics WHERE accountId = ?").bind(accountId).first<{
    accountId: string;
    platform: PlatformType;
    totalPublished: number;
    totalDrafts: number;
    totalFailed: number;
    lastPublishedAt: number | null;
    lastPublishedArticleId: string | null;
    publishHistory: string | null;
    updatedAt: number;
  }>();

  if (!result) return null;

  return {
    ...result,
    publishHistory: result.publishHistory ? JSON.parse(result.publishHistory) : [],
  };
}

export async function createOrUpdateAccountStatistics(
  db: D1Database,
  accountId: string,
  platform: PlatformType,
  updates: {
    incrementPublished?: boolean;
    incrementDrafts?: boolean;
    incrementFailed?: boolean;
    lastPublishedAt?: number;
    lastPublishedArticleId?: string;
    newHistoryItem?: {
      articleId: string;
      articleTitle: string;
      status: PublicationStatus;
      publishType: PublishType;
      publishedAt: number;
      publishedUrl?: string | null;
    };
  }
): Promise<AccountStatistics> {
  const now = Date.now();
  const existing = await getAccountStatistics(db, accountId);

  let publishHistory = existing?.publishHistory ?? [];
  
  if (updates.newHistoryItem) {
    publishHistory = [updates.newHistoryItem, ...publishHistory].slice(0, 50); // Keep last 50
  }

  const stats: AccountStatistics = {
    accountId,
    platform,
    totalPublished: (existing?.totalPublished ?? 0) + (updates.incrementPublished ? 1 : 0),
    totalDrafts: (existing?.totalDrafts ?? 0) + (updates.incrementDrafts ? 1 : 0),
    totalFailed: (existing?.totalFailed ?? 0) + (updates.incrementFailed ? 1 : 0),
    lastPublishedAt: updates.lastPublishedAt ?? existing?.lastPublishedAt ?? null,
    lastPublishedArticleId: updates.lastPublishedArticleId ?? existing?.lastPublishedArticleId ?? null,
    publishHistory,
    updatedAt: now,
  };

  await db.prepare(
    `INSERT INTO account_statistics 
     (accountId, platform, totalPublished, totalDrafts, totalFailed, lastPublishedAt, lastPublishedArticleId, publishHistory, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(accountId) DO UPDATE SET
     totalPublished = excluded.totalPublished,
     totalDrafts = excluded.totalDrafts,
     totalFailed = excluded.totalFailed,
     lastPublishedAt = excluded.lastPublishedAt,
     lastPublishedArticleId = excluded.lastPublishedArticleId,
     publishHistory = excluded.publishHistory,
     updatedAt = excluded.updatedAt`
  ).bind(
    stats.accountId,
    stats.platform,
    stats.totalPublished,
    stats.totalDrafts,
    stats.totalFailed,
    stats.lastPublishedAt,
    stats.lastPublishedArticleId,
    JSON.stringify(stats.publishHistory),
    stats.updatedAt
  ).run();

  return stats;
}

export async function listAccountStatistics(
  db: D1Database,
  platform?: PlatformType
): Promise<AccountStatistics[]> {
  let query = "SELECT * FROM account_statistics WHERE 1=1";
  const params: unknown[] = [];

  if (platform) {
    query += " AND platform = ?";
    params.push(platform);
  }

  query += " ORDER BY updatedAt DESC";

  const result = await db.prepare(query).bind(...params).all<{
    accountId: string;
    platform: PlatformType;
    totalPublished: number;
    totalDrafts: number;
    totalFailed: number;
    lastPublishedAt: number | null;
    lastPublishedArticleId: string | null;
    publishHistory: string | null;
    updatedAt: number;
  }>();

  return (result.results ?? []).map(row => ({
    ...row,
    publishHistory: row.publishHistory ? JSON.parse(row.publishHistory) : [],
  }));
}
