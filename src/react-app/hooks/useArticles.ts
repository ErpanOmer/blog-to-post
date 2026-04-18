import { useState, useCallback, useEffect } from "react";
import type { Article } from "@/react-app/types";
import {
  getArticles,
  createArticle as apiCreateArticle,
  updateArticle as apiUpdateArticle,
  deleteArticle as apiDeleteArticle,
} from "@/react-app/api";
import { notify } from "@/react-app/services/notification-service";

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
      const requestError = err instanceof Error ? err : new Error("加载文章失败");
      setError(requestError);
      console.error("加载文章失败", requestError);
      notify.error("加载文章失败", requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshArticles = useCallback(async () => {
    await fetchArticles();
  }, [fetchArticles]);

  const createArticle = useCallback(async (article: Article) => {
    try {
      const newArticle = await apiCreateArticle(article);
      setArticles((prev) => [newArticle, ...prev]);
      notify.success("创建成功", undefined, { showSystemNotification: true });
      return newArticle;
    } catch (err) {
      console.error("创建文章失败", err);
      notify.error("创建文章失败", err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, []);

  const updateArticle = useCallback(async (id: string, payload: Partial<Article>) => {
    try {
      const updatedArticle = await apiUpdateArticle(id, payload);
      setArticles((prev) => prev.map((item) => (item.id === id ? updatedArticle : item)));
      return updatedArticle;
    } catch (err) {
      console.error("更新文章失败", err);
      notify.error("更新文章失败", err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, []);

  const deleteArticle = useCallback(async (id: string) => {
    try {
      await apiDeleteArticle(id);
      setArticles((prev) => prev.filter((item) => item.id !== id));
      notify.success("删除成功", undefined, { showSystemNotification: true });
    } catch (err) {
      console.error("删除文章失败", err);
      notify.error("删除文章失败", err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, []);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  return {
    articles,
    loading,
    error,
    refreshArticles,
    createArticle,
    updateArticle,
    deleteArticle,
    setArticles,
  };
}
