import { useState, useCallback, useEffect } from "react";
import type { Article, PlatformType } from "@/react-app/types";
import { getArticles, createArticle as apiCreateArticle, updateArticle as apiUpdateArticle, deleteArticle as apiDeleteArticle } from "@/react-app/api";
import { notify } from "@/react-app/components/NotificationSystem";

export function useArticles() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getArticles();
            setArticles(data);
            setError(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to fetch articles");
            setError(error);
            console.error("加载文章失败", error);
            notify.error("加载文章失败", error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshArticles = useCallback(() => {
        fetchArticles();
    }, [fetchArticles]);

    const createArticle = useCallback(async (article: Article) => {
        try {
            const newArticle = await apiCreateArticle(article);
            setArticles((prev) => [newArticle, ...prev]);
            notify.success("创建成功", undefined, { showSystemNotification: true });
            return newArticle;
        } catch (err) {
            console.error("创建失败", err);
            notify.error("创建失败", err instanceof Error ? err.message : "未知错误");
            throw err;
        }
    }, []);

    const updateArticle = useCallback(async (id: string, payload: Partial<Article>) => {
        try {
            const updatedArticle = await apiUpdateArticle(id, payload);
            setArticles((prev) =>
                prev.map((item) => (item.id === id ? updatedArticle : item))
            );
            return updatedArticle; // 不要在这里提示 "保存成功"，因为可能是自动保存
        } catch (err) {
            console.error("更新失败", err);
            notify.error("更新失败", err instanceof Error ? err.message : "未知错误");
            throw err;
        }
    }, []);

    const deleteArticle = useCallback(async (id: string) => {
        try {
            await apiDeleteArticle(id);
            setArticles((prev) => prev.filter((item) => item.id !== id));
            notify.success("删除成功", undefined, { showSystemNotification: true });
        } catch (err) {
            console.error("删除失败", err);
            notify.error("删除失败", err instanceof Error ? err.message : "未知错误");
            throw err;
        }
    }, []);

    // 初始加载
    useEffect(() => {
        fetchArticles();
    }, [fetchArticles]);

    return {
        articles,
        loading,
        error,
        refreshArticles,
        createArticle,
        updateArticle,
        deleteArticle,
        setArticles // 暴露 setArticles 以便在某些特殊情况下（如快速发布更新）手动修改状态
    };
}
