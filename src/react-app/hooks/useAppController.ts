import { useState, useCallback, useEffect, useMemo } from "react";
import { useArticles } from "./useArticles";
import { createEmptyArticle } from "@/react-app/utils/articleDefaults";
import { notify, requestNotificationPermission } from "@/react-app/components/NotificationSystem";
import { getProviderStatus, createPublishTask } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { AccountConfig } from "@/react-app/types/publications";

export function useAppController() {
    const {
        articles,
        updateArticle,
        createArticle,
        deleteArticle,
        refreshArticles,
    } = useArticles();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Article | null>(null);
    const [providerStatus, setProviderStatus] = useState<{ provider: string; ready: boolean; lastCheckedAt: number; message: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [detailArticle, setDetailArticle] = useState<Article | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [articlesToPublish, setArticlesToPublish] = useState<Article[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId]);

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
        const handleContentGenerating = (e: CustomEvent<{ generating: boolean }>) => {
            setIsGenerating(e.detail.generating);
        };
        window.addEventListener('content-generating', handleContentGenerating as EventListener);
        return () => {
            window.removeEventListener('content-generating', handleContentGenerating as EventListener);
        };
    }, []);

    useEffect(() => {
        getProviderStatus().then(setProviderStatus).catch((error: Error) => {
            console.error("加载 Provider 失败", error);
        });
    }, []);

    useEffect(() => {
        if (selectedArticle) {
            setDraft(selectedArticle);
        }
    }, [selectedArticle]);

    const handleOpenEditor = useCallback(() => {
        const newArticle = createEmptyArticle();
        setDraft(newArticle);
        setIsEditorOpen(true);
    }, []);

    const handleCloseEditor = useCallback(() => {
        if (isGenerating) return;
        setIsEditorOpen(false);
        setDraft(null);
    }, [isGenerating]);

    const handleTitleChange = useCallback((title: string) => {
        setDraft((prev) => prev ? { ...prev, title } : prev);
    }, []);

    const handleArticleUpdate = useCallback((updates: Partial<Article>) => {
        setDraft((prev) => {
            if (!prev) return prev;
            return { ...prev, ...updates } as Article;
        });
    }, []);

    const handleSave = useCallback(() => {
        if (!draft || !isFormValid) return;
        requestNotificationPermission(); // Eagerly request permission

        setIsLoading(true);
        const exists = articles.some((item) => item.id === draft.id);
        const action = exists
            ? updateArticle(draft.id, {
                title: draft.title,
                content: draft.content,
                summary: draft.summary,
                tags: draft.tags,
                coverImage: draft.coverImage,
            })
            : createArticle({ ...draft, status: "draft" });

        action
            .then(() => {
                if (exists) {
                    notify.success("保存成功", undefined, { showSystemNotification: true });
                }
                setIsEditorOpen(false);
                setDraft(null);
            })
            .catch((error: Error) => {
                console.error("保存失败", error);
            })
            .finally(() => setIsLoading(false));
    }, [articles, draft, isFormValid, updateArticle, createArticle]);

    const handleQuickPublish = useCallback(() => {
        if (!draft || !isFormValid) return;
        requestNotificationPermission();
        setArticlesToPublish([draft]);
        setIsPublishDialogOpen(true);
    }, [draft, isFormValid]);

    const handleQuickPublishConfirm = useCallback(async (accountConfigs: AccountConfig[], scheduleTime: number | null) => {
        if (!draft) return;
        setIsPublishing(true);
        const loadingId = notify.loading("正在保存文章并创建发布任务...");

        try {
            const exists = articles.some((item) => item.id === draft.id);
            const savedArticle = exists
                ? await updateArticle(draft.id, { ...draft }) // Simplified spread
                : await createArticle({ ...draft, status: "draft" });

            const result = await createPublishTask({
                articleIds: [savedArticle.id],
                accountConfigs,
                scheduleTime,
            });

            refreshArticles();
            setIsEditorOpen(false);
            setDraft(null);

            notify.remove(loadingId);
            notify.success("发布任务已创建", result.message, { showSystemNotification: true });

            setTimeout(() => {
                setIsPublishDialogOpen(false);
                setIsPublishing(false);
            }, 1500);

        } catch (error) {
            notify.remove(loadingId);
            console.error("快速发布失败", error);
            notify.error("快速发布失败", error instanceof Error ? error.message : "请稍后再试");
            setIsPublishing(false);
        }
    }, [draft, articles, updateArticle, createArticle, refreshArticles]);

    const handleViewDetail = useCallback((article: Article) => {
        setDetailArticle(article);
        setIsDetailOpen(true);
    }, []);

    const handleEdit = useCallback((article: Article) => {
        if (article.status !== 'draft') {
            notify.error("只有草稿状态的文章才能编辑");
            return;
        }
        setDraft({ ...article });
        setIsEditorOpen(true);
    }, []);

    const handleDelete = useCallback((article: Article) => {
        if (article.status !== 'draft') {
            notify.error("只有草稿状态的文章才能删除");
            return;
        }
        if (!confirm(`确定要删除文章 "${article.title || '未命名文章'}" 吗？`)) {
            return;
        }
        requestNotificationPermission();
        deleteArticle(article.id)
            .then(() => {
                if (selectedId === article.id) {
                    setSelectedId(null);
                }
            })
            .catch((error: Error) => {
                console.error("删除失败", error);
            });
    }, [deleteArticle, selectedId]);

    const handlePublish = useCallback((articles: Article[]) => {
        setArticlesToPublish(articles);
        setIsPublishDialogOpen(true);
    }, []);

    const handlePublishConfirm = useCallback(async (accountConfigs: AccountConfig[], scheduleTime: number | null) => {
        setIsPublishing(true);
        const loadingId = notify.loading("正在创建发布任务...");
        try {
            const result = await createPublishTask({
                articleIds: articlesToPublish.map(a => a.id),
                accountConfigs,
                scheduleTime,
            });
            notify.remove(loadingId);
            notify.success("发布任务已创建", result.message, { showSystemNotification: true });
            refreshArticles();
            setTimeout(() => {
                setIsPublishDialogOpen(false);
                setIsPublishing(false);
            }, 1500);
        } catch (error) {
            notify.remove(loadingId);
            console.error("发布失败", error);
            notify.error("发布失败", error instanceof Error ? error.message : "请稍后再试");
            setIsPublishing(false);
        }
    }, [articlesToPublish, refreshArticles]);

    const handleDashboardNavigate = useCallback((tab: string) => {
        setActiveTab(tab);
    }, []);

    return {
        state: {
            articles,
            draft,
            isLoading,
            activeTab,
            isEditorOpen,
            isGenerating,
            detailArticle,
            isDetailOpen,
            isPublishDialogOpen,
            articlesToPublish,
            isPublishing,
            providerStatus,
            isFormValid,
        },
        actions: {
            setActiveTab,
            handleOpenEditor,
            handleCloseEditor,
            handleTitleChange,
            handleArticleUpdate,
            handleSave,
            handleQuickPublish,
            handleQuickPublishConfirm,
            handleViewDetail,
            handleEdit,
            handleDelete,
            handlePublish,
            handlePublishConfirm,
            handleDashboardNavigate,
            setIsDetailOpen, // needed
            setIsPublishDialogOpen, // needed
        },
    };
}
