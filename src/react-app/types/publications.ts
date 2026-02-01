import type { PlatformType } from "../types";

// 发布状态
export type PublicationStatus = 
  | "pending"      // 等待处理
  | "draft_created" // 草稿已创建
  | "publishing"   // 发布中
  | "published"    // 已发布
  | "failed"       // 失败
  | "cancelled";   // 已取消

// 发布类型
export type PublishType = "draft_only" | "full_publish";

// 任务类型
export type PublishTaskType = "single" | "batch" | "scheduled";

// 任务状态
export type PublishTaskStatus = 
  | "pending"     // 等待执行
  | "processing"  // 执行中
  | "completed"   // 已完成
  | "failed"      // 失败
  | "cancelled";  // 已取消

// 步骤类型
export type PublishStepType = 
  | "validate_account"  // 验证账号
  | "create_draft"      // 创建草稿
  | "publish_article"   // 发布文章
  | "verify_result";    // 验证结果

// 步骤状态
export type PublishStepStatus = 
  | "pending"   // 等待执行
  | "running"   // 执行中
  | "completed" // 已完成
  | "failed"    // 失败
  | "skipped";  // 已跳过

// 文章发布记录
export interface ArticlePublication {
  id: string;
  articleId: string;
  accountId: string;
  platform: PlatformType;
  status: PublicationStatus;
  publishType: PublishType;
  draftId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  startedAt: number;
  completedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

// 账号配置
export interface AccountConfig {
  accountId: string;
  platform: PlatformType;
  draftOnly: boolean; // 是否只发布到草稿
}

// 发布任务
export interface PublishTask {
  id: string;
  type: PublishTaskType;
  status: PublishTaskStatus;
  articleIds: string[];
  accountConfigs: AccountConfig[];
  scheduleTime?: number | null;
  currentStep: number;
  totalSteps: number;
  progressData?: PublishProgress | null;
  resultData?: PublishResult | null;
  errorData?: PublishError | null;
  createdAt: number;
  startedAt?: number | null;
  completedAt?: number | null;
  updatedAt: number;
}

// 发布进度
export interface PublishProgress {
  currentArticleIndex: number;
  totalArticles: number;
  currentAccountIndex: number;
  totalAccounts: number;
  currentStep: string;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
}

// 发布结果
export interface PublishResult {
  success: boolean;
  totalArticles: number;
  successfulPublications: number;
  failedPublications: number;
  draftOnlyPublications: number;
  details: PublicationDetail[];
}

// 发布详情
export interface PublicationDetail {
  articleId: string;
  accountId: string;
  platform: PlatformType;
  success: boolean;
  status: PublicationStatus;
  draftId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  duration: number;
}

// 发布错误
export interface PublishError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// 发布任务步骤
export interface PublishTaskStep {
  id: string;
  taskId: string;
  stepNumber: number;
  articleId?: string | null;
  accountId?: string | null;
  platform: PlatformType;
  stepType: PublishStepType;
  status: PublishStepStatus;
  startTime?: number | null;
  endTime?: number | null;
  duration?: number | null;
  inputData?: Record<string, unknown> | null;
  outputData?: Record<string, unknown> | null;
  errorMessage?: string | null;
  retryCount: number;
  createdAt: number;
}

// 账号统计
export interface AccountStatistics {
  accountId: string;
  platform: PlatformType;
  totalPublished: number;
  totalDrafts: number;
  totalFailed: number;
  lastPublishedAt?: number | null;
  lastPublishedArticleId?: string | null;
  publishHistory: PublishHistoryItem[];
  updatedAt: number;
}

// 发布历史项
export interface PublishHistoryItem {
  articleId: string;
  articleTitle: string;
  status: PublicationStatus;
  publishType: PublishType;
  publishedAt: number;
  publishedUrl?: string | null;
}

// 文章发布状态视图（用于前端展示）
export interface ArticlePublicationStatus {
  articleId: string;
  publications: PlatformPublicationStatus[];
}

// 平台发布状态
export interface PlatformPublicationStatus {
  platform: PlatformType;
  accountId: string;
  accountName?: string | null;
  status: PublicationStatus;
  publishType?: PublishType | null;
  publishedAt?: number | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
}

// 创建发布任务请求
export interface CreatePublishTaskRequest {
  articleIds: string[];
  accountConfigs: AccountConfig[];
  scheduleTime?: number | null;
}

// 发布任务响应
export interface PublishTaskResponse {
  task: PublishTask;
  message: string;
}

// 发布任务状态响应
export interface PublishTaskStatusResponse {
  task: PublishTask;
  steps: PublishTaskStep[];
}
