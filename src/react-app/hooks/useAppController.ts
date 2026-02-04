import { useState, useCallback, useEffect, useMemo } from "react";
import { useArticles } from "./useArticles";
import { createEmptyArticle } from "@/react-app/utils/articleDefaults";
import { notify, requestNotificationPermission } from "@/react-app/components/NotificationSystem";
import { getProviderStatus, createPublishTask } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { AccountConfig } from "@/react-app/types/publications";
import * as bytemd from "bytemd";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import math from "@bytemd/plugin-math";

const plugins = [
    gfm(),
    highlight(),
    breaks(),
    frontmatter(),
    gemoji(),
    math(),
];

function getHtmlContent(markdown: string): string {
    return bytemd.getProcessor({ plugins }).processSync(markdown).toString();
}

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
    const [distributionDetailTaskId, setDistributionDetailTaskId] = useState<string | null>(null); // New state for deep linking
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [detailArticle, setDetailArticle] = useState<Article | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [articlesToPublish, setArticlesToPublish] = useState<Article[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    // Global Confirmation State
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        description: string;
        confirmLabel?: string;
        variant?: "default" | "destructive";
        onConfirm: () => void;
        isLoading?: boolean;
    }>({
        open: false,
        title: "",
        description: "",
        onConfirm: () => { },
    });

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
    }, []);

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

        // Check if draft has content before closing
        if (draft && (draft.title.trim() || draft.content.trim())) {
            setConfirmDialog({
                open: true,
                title: "取消编辑",
                description: "您有未保存的内容，确定要关闭编辑器吗？关闭后内容将丢失。",
                confirmLabel: "确定关闭",
                variant: "destructive",
                onConfirm: () => {
                    setIsEditorOpen(false);
                    setDraft(null);
                    setConfirmDialog((prev) => ({ ...prev, open: false }));
                }
            });
            return;
        }

        setIsEditorOpen(false);
        setDraft(null);
    }, [isGenerating, draft]);

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
                htmlContent: getHtmlContent(draft.content),
                tags: draft.tags,
                coverImage: draft.coverImage,
            })
            : createArticle({ ...draft, status: "draft", htmlContent: getHtmlContent(draft.content) });

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
                notify.error("保存失败", error.message || "未知错误");
            })
            .finally(() => setIsLoading(false));
    }, [articles, draft, isFormValid, updateArticle, createArticle]);

    const handleQuickPublish = useCallback(() => {
        if (!draft || !isFormValid) return;
        requestNotificationPermission();
        setArticlesToPublish([draft]);
        setIsPublishDialogOpen(true);
    }, [draft, isFormValid]);

    const handleQuickPublishConfirm = useCallback(async (accountConfigs: AccountConfig[], scheduleTime: number | null): Promise<string | null> => {
        if (!draft) return null;
        setIsPublishing(true);
        // Remove loading notification here, let PublishDialog handle UI
        // const loadingId = notify.loading("正在保存文章并创建发布任务..."); 

        try {
            const exists = articles.some((item) => item.id === draft.id);
            const savedArticle = exists
                ? await updateArticle(draft.id, { ...draft, htmlContent: getHtmlContent(draft.content) })
                : await createArticle({ ...draft, status: "draft", htmlContent: getHtmlContent(draft.content) });

            const result = await createPublishTask({
                articleIds: [savedArticle.id],
                accountConfigs,
                scheduleTime,
            });

            refreshArticles();
            // Do NOT close editor or dialog here, let PublishDialog handle it based on progress
            // setIsEditorOpen(false); 
            // setDraft(null);

            // notify.remove(loadingId);
            // notify.success("发布任务已创建", result.message, { showSystemNotification: true });

            setIsPublishing(false); // Stop global loading, let dialog handle progress
            return result.task.id; // Return taskId

        } catch (error) {
            // notify.remove(loadingId);
            console.error("快速发布失败", error);
            notify.error("快速发布失败", error instanceof Error ? error.message : "请稍后再试");
            setIsPublishing(false);
            return null;
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

        setConfirmDialog({
            open: true,
            title: "删除文章",
            description: `确定要删除文章 "${article.title || '未命名文章'}" 吗？此操作无法撤销。`,
            confirmLabel: "确认删除",
            variant: "destructive",
            onConfirm: () => {
                setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
                // requestNotificationPermission(); // confirmDialog usually implies user interaction
                deleteArticle(article.id)
                    .then(() => {
                        if (selectedId === article.id) {
                            setSelectedId(null);
                        }
                        if (detailArticle?.id === article.id) {
                            setIsDetailOpen(false);
                            setDetailArticle(null);
                        }
                        notify.success("文章已删除");
                        setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
                    })
                    .catch((error: Error) => {
                        console.error("删除失败", error);
                        notify.error("删除失败", error.message || "未知错误");
                        setConfirmDialog((prev) => ({ ...prev, isLoading: false })); // Keep open on error? Or close? Usually keep open or show error toast. 
                        // Let's close it as error toast is shown
                        setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
                    });
            }
        });

    }, [deleteArticle, selectedId, detailArticle]);

    const handlePublish = useCallback((articles: Article[]) => {
        setArticlesToPublish(articles);
        setIsPublishDialogOpen(true);
    }, []);

    const handlePublishConfirm = useCallback(async (accountConfigs: AccountConfig[], scheduleTime: number | null): Promise<string | null> => {
        setIsPublishing(true);
        // const loadingId = notify.loading("正在创建发布任务...");
        try {
            const result = await createPublishTask({
                articleIds: articlesToPublish.map(a => a.id),
                accountConfigs,
                scheduleTime,
            });
            // notify.remove(loadingId);
            // notify.success("发布任务已创建", result.message, { showSystemNotification: true });
            refreshArticles();

            refreshArticles();

            setIsPublishing(false); // Stop global loading, let dialog handle progress
            return result.task.id; // Return taskId
        } catch (error) {
            // notify.remove(loadingId);
            console.error("发布失败", error);
            notify.error("发布失败", error instanceof Error ? error.message : "请稍后再试");
            setIsPublishing(false);
            return null;
        }
    }, [articlesToPublish, refreshArticles]);

    const handleOpenDistributionDetail = useCallback((taskId: string) => {
        setActiveTab("distribution");
        setDistributionDetailTaskId(taskId);
    }, []);

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
            distributionDetailTaskId, // Export new state
            confirmDialog, // Export confirm dialog state
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
            handleOpenDistributionDetail, // Export new action
            setDistributionDetailTaskId, // Export setter if needed for reset
            closeConfirmDialog, // Export close action
        },
    };
}
