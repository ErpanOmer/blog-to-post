import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import * as bytemd from "bytemd";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import math from "@bytemd/plugin-math";
import { useArticles } from "./useArticles";
import { createEmptyArticle } from "@/react-app/utils/articleDefaults";
import { notify, requestNotificationPermission } from "@/react-app/services/notification-service";
import { createPublishTask } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { AccountConfig } from "@/react-app/types/publications";
import { normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";
import {
  clearArticleDraftBackup,
  readArticleDraftBackup,
  readLatestTempArticleDraftBackup,
  saveArticleDraftBackup,
  shouldRestoreArticleDraftBackup,
} from "@/react-app/utils/articleDraftBackup";

const plugins = [gfm(), highlight(), breaks(), frontmatter(), gemoji(), math()];

function getHtmlContent(markdown: string): string {
  return bytemd.getProcessor({ plugins }).processSync(markdown).toString();
}

function isDraftSaveable(article: Article | null): boolean {
	if (!article) return false;
	return article.title.trim().length > 0 || article.content.trim().length > 0;
}

function isArticlePublishReady(article: Article | null): boolean {
  if (!article) return false;
  return (
    article.title.trim().length > 0 &&
    article.content.trim().length > 0 &&
    (article.summary?.trim().length ?? 0) > 0 &&
    (article.tags?.length ?? 0) > 0 &&
    (article.coverImage?.trim().length ?? 0) > 0
  );
}

function hasArticleChanges(article: Article, updates: Partial<Article>): boolean {
  return Object.entries(updates).some(([key, value]) => {
    const currentValue = article[key as keyof Article];
    if (Array.isArray(currentValue) && Array.isArray(value)) {
      return currentValue.length !== value.length || currentValue.some((item, index) => item !== value[index]);
    }
    return currentValue !== value;
  });
}

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
};

export function useAppController() {
  const { articles, hasLoaded: articlesLoaded, updateArticle, createArticle, deleteArticle, refreshArticles } = useArticles();

  const [draft, setDraft] = useState<Article | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const draftBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistPromiseRef = useRef<Promise<Article> | null>(null);
  const [distributionDetailTaskId, setDistributionDetailTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isQuickPublishMode, setIsQuickPublishMode] = useState(false);
  const [articlesToPublish, setArticlesToPublish] = useState<Article[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const isDraftSaveableState = useMemo(() => isDraftSaveable(draft), [draft]);
  const isPublishReady = useMemo(() => isArticlePublishReady(draft), [draft]);

  const cancelDraftBackupTimer = useCallback(() => {
    if (draftBackupTimerRef.current) {
      clearTimeout(draftBackupTimerRef.current);
      draftBackupTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleContentGenerating = (event: CustomEvent<{ generating: boolean }>) => {
      setIsGenerating(event.detail.generating);
    };

    window.addEventListener("content-generating", handleContentGenerating as EventListener);
    return () => {
      window.removeEventListener("content-generating", handleContentGenerating as EventListener);
    };
  }, []);

  useEffect(() => {
    cancelDraftBackupTimer();

    if (!draft || !isDraftDirty) return;

    draftBackupTimerRef.current = setTimeout(() => {
      saveArticleDraftBackup(draft);
      draftBackupTimerRef.current = null;
    }, 700);

    return () => {
      cancelDraftBackupTimer();
    };
  }, [cancelDraftBackupTimer, draft, isDraftDirty]);

  const openNewArticleEditor = useCallback(() => {
    cancelDraftBackupTimer();
    const latestBackup = readLatestTempArticleDraftBackup(articles.map((article) => article.id));
    if (latestBackup) {
      setDraft(latestBackup.article);
      setIsDraftDirty(true);
      notify.info("已恢复上次未保存的新文章", new Date(latestBackup.savedAt).toLocaleString("zh-CN"));
      return;
    }

    setDraft(createEmptyArticle());
    setIsDraftDirty(false);
  }, [articles, cancelDraftBackupTimer]);

  const openArticleEditor = useCallback((article: Article) => {
    if (article.status !== "draft") {
      notify.error("只有草稿状态的文章才能编辑");
      return false;
    }
    cancelDraftBackupTimer();
    const backup = readArticleDraftBackup(article.id);
    if (shouldRestoreArticleDraftBackup(article, backup)) {
      setDraft(backup.article);
      setIsDraftDirty(true);
      notify.info("已恢复本地实时备份", new Date(backup.savedAt).toLocaleString("zh-CN"));
    } else {
      setDraft({ ...article });
      setIsDraftDirty(false);
    }
    return true;
  }, [cancelDraftBackupTimer]);

  const clearDraft = useCallback(() => {
    cancelDraftBackupTimer();
    setDraft(null);
    setIsDraftDirty(false);
  }, [cancelDraftBackupTimer]);

  const leaveArticleEditor = useCallback(() => {
    cancelDraftBackupTimer();
    if (draft && isDraftDirty) {
      saveArticleDraftBackup(draft);
    }
    setDraft(null);
    setIsDraftDirty(false);
  }, [cancelDraftBackupTimer, draft, isDraftDirty]);

  const handleTitleChange = useCallback((title: string) => {
    if (!draft || draft.title === title) return;
    setIsDraftDirty(true);
    setDraft({ ...draft, title });
  }, [draft]);

  const handleArticleUpdate = useCallback((updates: Partial<Article>) => {
    if (!draft) return;
    const normalizedUpdates = updates.content !== undefined
      ? { ...updates, content: normalizeMarkdownImageSyntax(updates.content) }
      : updates;
    if (!hasArticleChanges(draft, normalizedUpdates)) return;
    setIsDraftDirty(true);
    setDraft({ ...draft, ...normalizedUpdates });
  }, [draft]);

  const persistDraft = useCallback(async (): Promise<Article> => {
    if (persistPromiseRef.current) return persistPromiseRef.current;

    const snapshot = draft ? { ...draft, tags: [...(draft.tags ?? [])] } : null;
    if (!snapshot) {
      throw new Error("当前没有可保存的草稿");
    }
    if (!isDraftSaveable(snapshot)) {
      throw new Error("请至少填写标题或正文后再保存草稿");
    }

    cancelDraftBackupTimer();
    const operation = (async () => {
      try {
        const normalizedContent = normalizeMarkdownImageSyntax(snapshot.content);
        const payload: Partial<Article> = {
          title: snapshot.title,
          content: normalizedContent,
          summary: snapshot.summary,
          htmlContent: getHtmlContent(normalizedContent),
          tags: snapshot.tags,
          coverImage: snapshot.coverImage,
        };

        const exists = articles.some((item) => item.id === snapshot.id);
        const savedArticle = exists
          ? await updateArticle(snapshot.id, payload)
          : await createArticle({ ...snapshot, ...payload, status: "draft" } as Article);

        clearArticleDraftBackup(snapshot.id);
        clearArticleDraftBackup(savedArticle.id);
        setIsDraftDirty(false);
        setDraft(savedArticle);
        return savedArticle;
      } catch (error) {
        saveArticleDraftBackup(snapshot);
        setIsDraftDirty(true);
        throw error;
      }
    })();

    persistPromiseRef.current = operation;
    try {
      return await operation;
    } finally {
      persistPromiseRef.current = null;
    }
  }, [articles, cancelDraftBackupTimer, createArticle, draft, updateArticle]);

  const handleSave = useCallback(async (): Promise<Article | null> => {
    requestNotificationPermission();
    setIsLoading(true);
    try {
      const savedArticle = await persistDraft();
      notify.success("保存成功", undefined, { showSystemNotification: true });
      return savedArticle;
    } catch (error) {
      console.error("保存失败", error);
      notify.error("保存失败", error instanceof Error ? error.message : "未知错误");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [persistDraft]);

  const handleQuickPublish = useCallback(() => {
    if (!draft || !isPublishReady) return;
    requestNotificationPermission();
    setIsQuickPublishMode(true);
    setArticlesToPublish([draft]);
    setIsPublishDialogOpen(true);
  }, [draft, isPublishReady]);

  const handleQuickPublishConfirm = useCallback(
    async (accountConfigs: AccountConfig[], scheduleTime: number | null): Promise<string | null> => {
      if (!draft) return null;
      setIsPublishing(true);

      try {
        const savedArticle = await persistDraft();
        setArticlesToPublish([savedArticle]);

        const result = await createPublishTask({
          articleIds: [savedArticle.id],
          accountConfigs,
          scheduleTime,
        });

        await refreshArticles().catch((error) => {
          console.warn("快速发布后刷新文章列表失败", error);
        });

        return result.task.id;
      } catch (error) {
        console.error("快速发布失败", error);
        notify.error("快速发布失败", error instanceof Error ? error.message : "请稍后重试");
        return null;
      } finally {
        setIsPublishing(false);
      }
    },
    [draft, persistDraft, refreshArticles],
  );

  const handleDelete = useCallback(
    (article: Article) => {
      if (article.status !== "draft") {
        notify.error("只有草稿状态的文章才能删除");
        return;
      }

      setConfirmDialog({
        open: true,
        title: "删除文章",
        description: `确定删除《${article.title || "未命名文章"}》吗？删除后无法恢复。`,
        confirmLabel: "确认删除",
        variant: "destructive",
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          deleteArticle(article.id)
            .then(() => {
              setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
            })
            .catch((error: Error) => {
              console.error("删除失败", error);
              notify.error("删除失败", error.message || "未知错误");
              setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
            });
        },
      });
    },
    [deleteArticle],
  );

  const handleBatchDelete = useCallback(
    (targetArticles: Article[]) => {
      if (targetArticles.length === 0) return;

      const lockedArticles = targetArticles.filter((article) => article.status !== "draft");
      if (lockedArticles.length > 0) {
        notify.error("只能批量删除草稿文章", `当前选择中有 ${lockedArticles.length} 篇文章不是草稿状态`);
        return;
      }

      setConfirmDialog({
        open: true,
        title: "批量删除文章",
        description: `确定删除已选择的 ${targetArticles.length} 篇草稿文章吗？删除后无法恢复。`,
        confirmLabel: "确认批量删除",
        variant: "destructive",
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          Promise.all(targetArticles.map((article) => deleteArticle(article.id).then(() => {
            clearArticleDraftBackup(article.id);
          })))
            .then(() => {
              notify.success("批量删除成功");
              setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
            })
            .catch((error: Error) => {
              console.error("批量删除失败", error);
              notify.error("批量删除失败", error.message || "未知错误");
              setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
            });
        },
      });
    },
    [deleteArticle],
  );

  const handlePublish = useCallback((targetArticles: Article[]) => {
    setIsQuickPublishMode(false);
    setArticlesToPublish(targetArticles);
    setIsPublishDialogOpen(true);
  }, []);

  const handlePublishConfirm = useCallback(
    async (accountConfigs: AccountConfig[], scheduleTime: number | null): Promise<string | null> => {
      setIsPublishing(true);
      try {
        const result = await createPublishTask({
          articleIds: articlesToPublish.map((article) => article.id),
          accountConfigs,
          scheduleTime,
        });

        await refreshArticles().catch((error) => {
          console.warn("发布后刷新文章列表失败", error);
        });

        return result.task.id;
      } catch (error) {
        console.error("创建发布任务失败", error);
        notify.error("创建发布任务失败", error instanceof Error ? error.message : "请稍后重试");
        return null;
      } finally {
        setIsPublishing(false);
      }
    },
    [articlesToPublish, refreshArticles],
  );

  const handleOpenDistributionDetail = useCallback((taskId: string) => {
    setDistributionDetailTaskId(taskId);
  }, []);

  return {
    state: {
      articles,
      articlesLoaded,
      draft,
      isDraftDirty,
      isLoading,
      isGenerating,
      isPublishDialogOpen,
      isQuickPublishMode,
      articlesToPublish,
      isPublishing,
      isDraftSaveable: isDraftSaveableState,
      isPublishReady,
      distributionDetailTaskId,
      confirmDialog,
    },
    actions: {
      setDraft,
      clearDraft,
      leaveArticleEditor,
      openNewArticleEditor,
      openArticleEditor,
      handleTitleChange,
      handleArticleUpdate,
      handleSave,
      handleQuickPublish,
      handleQuickPublishConfirm,
      handleDelete,
      handleBatchDelete,
      handlePublish,
      handlePublishConfirm,
      setIsPublishDialogOpen,
      setIsQuickPublishMode,
      handleOpenDistributionDetail,
      setDistributionDetailTaskId,
      closeConfirmDialog,
    },
  };
}
