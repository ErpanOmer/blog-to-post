import { useState, useCallback, useEffect, useMemo } from "react";
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
import { createPublishTask, getProviderStatus } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { AccountConfig } from "@/react-app/types/publications";
import { normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";

const plugins = [gfm(), highlight(), breaks(), frontmatter(), gemoji(), math()];

function getHtmlContent(markdown: string): string {
  return bytemd.getProcessor({ plugins }).processSync(markdown).toString();
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
  const { articles, updateArticle, createArticle, deleteArticle, refreshArticles } = useArticles();

  const [draft, setDraft] = useState<Article | null>(null);
  const [providerStatus, setProviderStatus] = useState<{
    provider: string;
    ready: boolean;
    lastCheckedAt: number;
    message: string;
    defaultModel?: string;
  } | null>(null);
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

  const isFormValid = useMemo(() => {
    if (!draft) return false;
    return (
      draft.title.trim().length > 0 &&
      draft.content.trim().length > 0 &&
      (draft.summary?.trim().length ?? 0) > 0 &&
      (draft.tags?.length ?? 0) > 0 &&
      (draft.coverImage?.trim().length ?? 0) > 0
    );
  }, [draft]);

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
    getProviderStatus()
      .then(setProviderStatus)
      .catch((error: Error) => {
        console.error("加载模型服务状态失败", error);
      });
  }, []);

  const openNewArticleEditor = useCallback(() => {
    setDraft(createEmptyArticle());
  }, []);

  const openArticleEditor = useCallback((article: Article) => {
    if (article.status !== "draft") {
      notify.error("只有草稿状态的文章才能编辑");
      return false;
    }
    setDraft({ ...article });
    return true;
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setDraft((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  const handleArticleUpdate = useCallback((updates: Partial<Article>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const normalizedUpdates = updates.content !== undefined
        ? { ...updates, content: normalizeMarkdownImageSyntax(updates.content) }
        : updates;
      return { ...prev, ...normalizedUpdates } as Article;
    });
  }, []);

  const persistDraft = useCallback(async (): Promise<Article> => {
    if (!draft) {
      throw new Error("当前没有可保存的草稿");
    }
    if (!isFormValid) {
      throw new Error("请先补全标题、正文、摘要、标签和封面");
    }

    const normalizedContent = normalizeMarkdownImageSyntax(draft.content);
    const payload: Partial<Article> = {
      title: draft.title,
      content: normalizedContent,
      summary: draft.summary,
      htmlContent: getHtmlContent(normalizedContent),
      tags: draft.tags,
      coverImage: draft.coverImage,
    };

    const exists = articles.some((item) => item.id === draft.id);
    const savedArticle = exists
      ? await updateArticle(draft.id, payload)
      : await createArticle({ ...draft, ...payload, status: "draft" } as Article);

    setDraft(savedArticle);
    return savedArticle;
  }, [articles, createArticle, draft, isFormValid, updateArticle]);

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
    if (!draft || !isFormValid) return;
    requestNotificationPermission();
    setIsQuickPublishMode(true);
    setArticlesToPublish([draft]);
    setIsPublishDialogOpen(true);
  }, [draft, isFormValid]);

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
              notify.success("文章已删除");
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
      draft,
      isLoading,
      isGenerating,
      isPublishDialogOpen,
      isQuickPublishMode,
      articlesToPublish,
      isPublishing,
      providerStatus,
      isFormValid,
      distributionDetailTaskId,
      confirmDialog,
    },
    actions: {
      setDraft,
      clearDraft,
      openNewArticleEditor,
      openArticleEditor,
      handleTitleChange,
      handleArticleUpdate,
      handleSave,
      handleQuickPublish,
      handleQuickPublishConfirm,
      handleDelete,
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
