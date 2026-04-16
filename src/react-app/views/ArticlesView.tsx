import { FileText } from "lucide-react";
import { SectionCard } from "@/react-app/components/SectionCard";
import { ArticleList } from "@/react-app/components/ArticleList";
import type { Article } from "@/react-app/types";

interface ArticlesViewProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit: (article: Article) => void;
  onDelete: (article: Article) => void;
  onPublish: (articles: Article[]) => void;
}

export function ArticlesView({ articles, onViewDetail, onEdit, onDelete, onPublish }: ArticlesViewProps) {
  return (
    <SectionCard
      title="文章列表"
      description="在这里管理你的文章，支持批量选择、查看详情、编辑和分发。"
      icon={<FileText className="h-5 w-5" />}
    >
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
        <ArticleList
          articles={articles}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
        />
      </div>
    </SectionCard>
  );
}
