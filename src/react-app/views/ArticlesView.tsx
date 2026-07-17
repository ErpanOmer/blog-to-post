import { useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/react-app/components/SectionCard";
import { ArticleList } from "@/react-app/components/ArticleList";
import { getPlatformAccounts, getPublications, validateAllArticlePublicationLinks } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { ArticlePublication } from "@/react-app/types/publications";
import { subscribeToArticlePublicationUpdates } from "@/react-app/services/publication-events";

interface ArticlesViewProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit: (article: Article) => void;
  onDelete: (article: Article) => void;
  onDeleteMany?: (articles: Article[]) => void;
  onPublish: (articles: Article[]) => void;
}

export function ArticlesView({ articles, onViewDetail, onEdit, onDelete, onDeleteMany, onPublish }: ArticlesViewProps) {
  const [isCleaningLinks, setIsCleaningLinks] = useState(false);
  const [publications, setPublications] = useState<ArticlePublication[]>([]);
  const [publicationAccountNames, setPublicationAccountNames] = useState<Map<string, string>>(new Map());
  const [isPublicationDataLoading, setIsPublicationDataLoading] = useState(true);
  const publicationHistorySignatureRef = useRef<string | null>(null);
  const publicationHistoryLoadingRef = useRef(false);

  const loadPublicationHistory = useCallback(async () => {
    if (publicationHistoryLoadingRef.current) return;
    publicationHistoryLoadingRef.current = true;
    try {
      const history = await getPublications();
      const nextSignature = history
        .map((publication) => [
          publication.id,
          publication.status,
          publication.publishedUrl ?? "",
          publication.updatedAt,
        ].join(":"))
        .sort()
        .join("|");
      const historyChanged = publicationHistorySignatureRef.current !== nextSignature;

      if (historyChanged) {
        publicationHistorySignatureRef.current = nextSignature;
        setPublications(history);
      }
    } catch (error) {
      console.error("Load article publication history failed", error);
    } finally {
      publicationHistoryLoadingRef.current = false;
      setIsPublicationDataLoading(false);
    }
  }, []);

  useEffect(() => subscribeToArticlePublicationUpdates(() => {
    void loadPublicationHistory();
  }), [loadPublicationHistory]);

  useEffect(() => {
    let cancelled = false;
    void getPlatformAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setPublicationAccountNames(new Map(
          accounts.map((account) => [account.id, account.userName || "未命名账号"]),
        ));
      })
      .catch((error) => console.error("Load publication account names failed", error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadPublicationHistory();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadPublicationHistory();
      }
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadPublicationHistory]);

  const handleCleanPublicationLinks = async () => {
    setIsCleaningLinks(true);
    try {
      const result = await validateAllArticlePublicationLinks();
      publicationHistorySignatureRef.current = null;
      setPublications(result.publications);
      toast.success(
        `链接清理完成：去重 ${result.deduplicated.length} 条，移除失效 ${result.removed.length} 条，恢复 ${result.restored.length} 条`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "链接清理失败");
    } finally {
      setIsCleaningLinks(false);
    }
  };

  return (
    <SectionCard
      title="文章列表"
      description="在这里管理你的文章，支持批量选择、查看详情、编辑和分发。"
      icon={<FileText className="h-5 w-5" />}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCleanPublicationLinks}
          disabled={isCleaningLinks}
          className="gap-1.5"
        >
          {isCleaningLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          链接清理
        </Button>
      }
    >
      <ArticleList
        articles={articles}
        onViewDetail={onViewDetail}
        onEdit={onEdit}
        onDelete={onDelete}
        onDeleteMany={onDeleteMany}
        onPublish={onPublish}
        publicationHistory={publications}
        publicationAccountNames={publicationAccountNames}
        publicationDataLoading={isPublicationDataLoading}
      />
    </SectionCard>
  );
}
