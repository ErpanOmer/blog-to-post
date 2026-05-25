import { useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/react-app/components/SectionCard";
import { ArticleList } from "@/react-app/components/ArticleList";
import { getPublications, validateAllArticlePublicationLinks } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { ArticlePublication } from "@/react-app/types/publications";

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
  const [publicationRefreshKey, setPublicationRefreshKey] = useState(0);
  const [publications, setPublications] = useState<ArticlePublication[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const history = await getPublications();
        if (!cancelled) {
          setPublications(history);
        }
      } catch (error) {
        console.error("加载文章分发筛选数据失败", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicationRefreshKey]);

  const handleCleanPublicationLinks = async () => {
    setIsCleaningLinks(true);
    try {
      const result = await validateAllArticlePublicationLinks();
      setPublicationRefreshKey((value) => value + 1);
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
        publicationRefreshKey={publicationRefreshKey}
        publicationHistory={publications}
      />
    </SectionCard>
  );
}
