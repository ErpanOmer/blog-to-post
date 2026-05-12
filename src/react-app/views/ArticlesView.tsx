import { useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/react-app/components/SectionCard";
import { ArticleList } from "@/react-app/components/ArticleList";
import { validateAllArticlePublicationLinks } from "@/react-app/api";
import type { Article } from "@/react-app/types";

interface ArticlesViewProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit: (article: Article) => void;
  onDelete: (article: Article) => void;
  onPublish: (articles: Article[]) => void;
}

export function ArticlesView({ articles, onViewDetail, onEdit, onDelete, onPublish }: ArticlesViewProps) {
  const [isCleaningLinks, setIsCleaningLinks] = useState(false);
  const [publicationRefreshKey, setPublicationRefreshKey] = useState(0);

  const handleCleanPublicationLinks = async () => {
    setIsCleaningLinks(true);
    try {
      const result = await validateAllArticlePublicationLinks();
      setPublicationRefreshKey((value) => value + 1);
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
        onPublish={onPublish}
        publicationRefreshKey={publicationRefreshKey}
      />
    </SectionCard>
  );
}
