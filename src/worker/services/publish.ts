import type { D1Database } from "@cloudflare/workers-types";
import type { Article } from "../types";
import type { 
  PublishTask, 
  AccountConfig,
  PublicationStatus,
  PublishResult,
  PublicationDetail
} from "../types/publications";
import { getAccountService } from "../accounts";
import { getPlatformAccount } from "../db/platform-accounts";
import { getArticle } from "../db/articles";
import { 
  createPublishTask, 
  createPublishTaskStep,
  updatePublishTaskStep,
  createArticlePublication,
  updateArticlePublication,
  createOrUpdateAccountStatistics
} from "../db/publications";

// 发布步骤定义
interface PublishStep {
  type: "validate_account" | "create_draft" | "publish_article" | "verify_result";
  name: string;
  execute: (
    db: D1Database,
    article: Article,
    accountConfig: AccountConfig,
    draftId?: string
  ) => Promise<{ success: boolean; draftId?: string; publishedUrl?: string; error?: string }>;
}

// 步骤执行器
const publishSteps: PublishStep[] = [
  {
    type: "validate_account",
    name: "验证账号",
    execute: async (db, _article, accountConfig) => {
      const account = await getPlatformAccount(db, accountConfig.accountId);
      if (!account) {
        return { success: false, error: "账号不存在" };
      }
      if (!account.isActive) {
        return { success: false, error: "账号未激活" };
      }
      if (!account.isVerified) {
        return { success: false, error: "账号未验证" };
      }
      if (!account.authToken) {
        return { success: false, error: "账号未配置认证信息" };
      }
      return { success: true };
    }
  },
  {
    type: "create_draft",
    name: "创建草稿",
    execute: async (db, _article, accountConfig) => {
      const account = await getPlatformAccount(db, accountConfig.accountId);
      if (!account?.authToken) {
        return { success: false, error: "账号认证信息缺失" };
      }

      const service = getAccountService(account.platform, account.authToken);
      if (!service) {
        return { success: false, error: `不支持的平台类型: ${account.platform}` };
      }

      try {
        // 调用平台的 articleDraft 方法创建草稿
        const draft = await service.articleDraft();
        if (!draft) {
          return { success: false, error: "创建草稿失败：平台返回空数据" };
        }
        return { success: true, draftId: draft.id };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "创建草稿失败" 
        };
      }
    }
  },
  {
    type: "publish_article",
    name: "发布文章",
    execute: async (db, article, accountConfig, _draftId) => {
      const account = await getPlatformAccount(db, accountConfig.accountId);
      if (!account?.authToken) {
        return { success: false, error: "账号认证信息缺失" };
      }

      const service = getAccountService(account.platform, account.authToken);
      if (!service) {
        return { success: false, error: `不支持的平台类型: ${account.platform}` };
      }

      try {
        const result = await service.articlePublish(
          article.title,
          article.content,
          article.coverImage ?? undefined
        );
        
        if (!result.success) {
          return { success: false, error: result.message };
        }
        
        return { 
          success: true, 
          draftId: result.articleId,
          publishedUrl: result.url 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "发布文章失败" 
        };
      }
    }
  },
  {
    type: "verify_result",
    name: "验证结果",
    execute: async (_db, _article, _accountConfig, _draftId) => {
      // 验证发布结果，可以查询平台确认文章状态
      return { success: true };
    }
  }
];

// 创建发布任务
export async function createPublishTaskService(
  db: D1Database,
  params: {
    articleIds: string[];
    accountConfigs: AccountConfig[];
    scheduleTime?: number | null;
  }
): Promise<{ task: PublishTask; message: string }> {
  const { articleIds, accountConfigs, scheduleTime } = params;

  // 验证文章存在
  for (const articleId of articleIds) {
    const article = await getArticle(db, articleId);
    if (!article) {
      throw new Error(`文章不存在: ${articleId}`);
    }
  }

  // 验证账号存在且可用
  for (const config of accountConfigs) {
    const account = await getPlatformAccount(db, config.accountId);
    if (!account) {
      throw new Error(`账号不存在: ${config.accountId}`);
    }
    if (!account.isActive) {
      throw new Error(`账号未激活: ${account.userName || config.accountId}`);
    }
  }

  const now = Date.now();
  const isScheduled = scheduleTime && scheduleTime > now;
  
  const taskType = articleIds.length > 1 ? "batch" : isScheduled ? "scheduled" : "single";
  
  const task = await createPublishTask(db, {
    id: crypto.randomUUID(),
    type: taskType,
    articleIds,
    accountConfigs,
    scheduleTime: isScheduled ? scheduleTime : null,
  });

  // 如果不是定时任务，立即执行
  if (!isScheduled) {
    // 异步执行任务
    executePublishTask(db, task.id).catch(console.error);
  }

  return {
    task,
    message: isScheduled 
      ? `定时发布任务已创建，将在 ${new Date(scheduleTime!).toLocaleString()} 执行`
      : "发布任务已创建并开始执行"
  };
}

// 执行发布任务
export async function executePublishTask(
  db: D1Database,
  taskId: string
): Promise<PublishResult> {
  const { getPublishTask, updatePublishTask } = await import("../db/publications");
  
  const task = await getPublishTask(db, taskId);
  if (!task) {
    throw new Error("任务不存在");
  }

  if (task.status === "processing") {
    throw new Error("任务正在执行中");
  }

  if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
    throw new Error("任务已结束");
  }

  // 更新任务状态为执行中
  await updatePublishTask(db, taskId, {
    status: "processing",
    startedAt: Date.now(),
    progressData: {
      currentArticleIndex: 0,
      totalArticles: task.articleIds.length,
      currentAccountIndex: 0,
      totalAccounts: task.accountConfigs.length,
      currentStep: "开始执行",
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
    }
  });

  const details: PublicationDetail[] = [];
  let stepNumber = 0;

  try {
    // 遍历每篇文章
    for (let articleIndex = 0; articleIndex < task.articleIds.length; articleIndex++) {
      const articleId = task.articleIds[articleIndex];
      const article = await getArticle(db, articleId);
      
      if (!article) {
        console.error(`文章不存在: ${articleId}`);
        continue;
      }

      // 遍历每个账号
      for (let accountIndex = 0; accountIndex < task.accountConfigs.length; accountIndex++) {
        const accountConfig = task.accountConfigs[accountIndex];
        
        // 更新进度
        await updatePublishTask(db, taskId, {
          progressData: {
            currentArticleIndex: articleIndex,
            totalArticles: task.articleIds.length,
            currentAccountIndex: accountIndex,
            totalAccounts: task.accountConfigs.length,
            currentStep: `处理文章: ${article.title} -> 平台: ${accountConfig.platform}`,
            completedSteps: stepNumber,
            failedSteps: details.filter(d => !d.success).length,
            skippedSteps: 0,
          }
        });

        // 创建发布记录
        const publication = await createArticlePublication(db, {
          id: crypto.randomUUID(),
          articleId,
          accountId: accountConfig.accountId,
          platform: accountConfig.platform,
          publishType: accountConfig.draftOnly ? "draft_only" : "full_publish",
          status: "pending",
        });

        let draftId: string | undefined;
        let currentStatus: PublicationStatus = "pending";
        let publishedUrl: string | undefined;
        let errorMessage: string | undefined;
        const startTime = Date.now();

        // 执行发布步骤
        for (const step of publishSteps) {
          stepNumber++;
          
          // 如果只需要草稿，跳过发布步骤
          if (accountConfig.draftOnly && step.type === "publish_article") {
            currentStatus = "draft_created";
            break;
          }

          // 创建步骤记录
          const taskStep = await createPublishTaskStep(db, {
            id: crypto.randomUUID(),
            taskId,
            stepNumber,
            articleId,
            accountId: accountConfig.accountId,
            platform: accountConfig.platform,
            stepType: step.type,
            inputData: { articleId, accountId: accountConfig.accountId, draftId },
          });

          // 更新步骤状态为执行中
          await updatePublishTaskStep(db, taskStep.id, {
            status: "running",
            startTime: Date.now(),
          });

          const stepStartTime = Date.now();
          const result = await step.execute(db, article, accountConfig, draftId);
          const stepDuration = Date.now() - stepStartTime;

          if (result.success) {
            await updatePublishTaskStep(db, taskStep.id, {
              status: "completed",
              endTime: Date.now(),
              duration: stepDuration,
              outputData: { draftId: result.draftId, publishedUrl: result.publishedUrl },
            });

            if (result.draftId) {
              draftId = result.draftId;
            }
            if (result.publishedUrl) {
              publishedUrl = result.publishedUrl;
            }
          } else {
            await updatePublishTaskStep(db, taskStep.id, {
              status: "failed",
              endTime: Date.now(),
              duration: stepDuration,
              errorMessage: result.error,
            });

            errorMessage = result.error;
            currentStatus = "failed";
            break;
          }
        }

        // 确定最终状态
        if (!errorMessage) {
          currentStatus = accountConfig.draftOnly ? "draft_created" : "published";
        }

        const duration = Date.now() - startTime;

        // 更新发布记录
        await updateArticlePublication(db, publication.id, {
          status: currentStatus,
          draftId: draftId ?? null,
          publishedUrl: publishedUrl ?? null,
          errorMessage: errorMessage ?? null,
          completedAt: Date.now(),
        });

        // 更新账号统计
        await createOrUpdateAccountStatistics(db, accountConfig.accountId, accountConfig.platform, {
          incrementPublished: currentStatus === "published",
          incrementDrafts: currentStatus === "draft_created",
          incrementFailed: currentStatus === "failed",
          lastPublishedAt: Date.now(),
          lastPublishedArticleId: articleId,
          newHistoryItem: {
            articleId,
            articleTitle: article.title,
            status: currentStatus,
            publishType: accountConfig.draftOnly ? "draft_only" : "full_publish",
            publishedAt: Date.now(),
            publishedUrl: publishedUrl ?? null,
          },
        });

        // 记录详情
        details.push({
          articleId,
          accountId: accountConfig.accountId,
          platform: accountConfig.platform,
          success: currentStatus === "published" || currentStatus === "draft_created",
          status: currentStatus,
          draftId: draftId ?? null,
          publishedUrl: publishedUrl ?? null,
          errorMessage: errorMessage ?? null,
          duration,
        });
      }
    }

    // 计算结果
    const successfulPublications = details.filter(d => d.success).length;
    const failedPublications = details.filter(d => !d.success).length;
    const draftOnlyPublications = details.filter(d => d.status === "draft_created").length;

    const result: PublishResult = {
      success: failedPublications === 0,
      totalArticles: task.articleIds.length,
      successfulPublications,
      failedPublications,
      draftOnlyPublications,
      details,
    };

    // 更新任务状态为完成
    await updatePublishTask(db, taskId, {
      status: failedPublications === 0 ? "completed" : "failed",
      completedAt: Date.now(),
      resultData: result,
      progressData: {
        currentArticleIndex: task.articleIds.length,
        totalArticles: task.articleIds.length,
        currentAccountIndex: task.accountConfigs.length,
        totalAccounts: task.accountConfigs.length,
        currentStep: "执行完成",
        completedSteps: stepNumber,
        failedSteps: failedPublications,
        skippedSteps: 0,
      }
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    
    // 更新任务状态为失败
    await updatePublishTask(db, taskId, {
      status: "failed",
      completedAt: Date.now(),
      errorData: {
        code: "EXECUTION_ERROR",
        message: errorMessage,
      },
    });

    return {
      success: false,
      totalArticles: task.articleIds.length,
      successfulPublications: details.filter(d => d.success).length,
      failedPublications: details.filter(d => !d.success).length + 1,
      draftOnlyPublications: details.filter(d => d.status === "draft_created").length,
      details,
    };
  }
}

// 取消发布任务
export async function cancelPublishTask(
  db: D1Database,
  taskId: string
): Promise<{ success: boolean; message: string }> {
  const { getPublishTask, updatePublishTask } = await import("../db/publications");
  
  const task = await getPublishTask(db, taskId);
  if (!task) {
    return { success: false, message: "任务不存在" };
  }

  if (task.status === "completed" || task.status === "failed") {
    return { success: false, message: "任务已结束，无法取消" };
  }

  if (task.status === "cancelled") {
    return { success: false, message: "任务已取消" };
  }

  await updatePublishTask(db, taskId, {
    status: "cancelled",
    completedAt: Date.now(),
  });

  return { success: true, message: "任务已取消" };
}

// 获取发布任务状态
export async function getPublishTaskStatus(
  db: D1Database,
  taskId: string
) {
  const { getPublishTask, listPublishTaskSteps } = await import("../db/publications");
  
  const task = await getPublishTask(db, taskId);
  if (!task) {
    throw new Error("任务不存在");
  }

  const steps = await listPublishTaskSteps(db, taskId);

  return { task, steps };
}

// 快速发布单篇文章到单个账号
export async function quickPublish(
  db: D1Database,
  articleId: string,
  accountId: string,
  draftOnly: boolean = false
): Promise<{ success: boolean; message: string; publicationId?: string }> {
  const account = await getPlatformAccount(db, accountId);
  if (!account) {
    return { success: false, message: "账号不存在" };
  }

  const task = await createPublishTaskService(db, {
    articleIds: [articleId],
    accountConfigs: [{
      accountId,
      platform: account.platform,
      draftOnly,
    }],
  });

  return {
    success: true,
    message: "快速发布任务已创建",
    publicationId: task.task.id,
  };
}

// 处理定时任务（由 cron 调用）
export async function processScheduledTasks(db: D1Database): Promise<void> {
  const { getPendingScheduledTasks } = await import("../db/publications");
  
  const tasks = await getPendingScheduledTasks(db);
  
  for (const task of tasks) {
    console.log(`执行定时发布任务: ${task.id}`);
    executePublishTask(db, task.id).catch(error => {
      console.error(`定时任务执行失败: ${task.id}`, error);
    });
  }
}
