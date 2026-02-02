import { FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionCard } from "../components/SectionCard";
import { ArticleList } from "../components/ArticleList";
import type { Article } from "../types";

interface ArticlesViewProps {
    articles: Article[];
    onViewDetail: (article: Article) => void;
    onEdit: (article: Article) => void;
    onDelete: (article: Article) => void;
    onPublish: (articles: Article[]) => void;
}

export function ArticlesView({
    articles,
    onViewDetail,
    onEdit,
    onDelete,
    onPublish,
}: ArticlesViewProps) {
    return (
        <SectionCard
            title="文章清单"
            description="管理所有文章，支持批量操作和发布。"
            icon={<FileText className="h-5 w-5" />}
        >
            <ScrollArea className="h-[600px] pr-4">
                <ArticleList
                    articles={articles}
                    onViewDetail={onViewDetail}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPublish={onPublish}
                />
            </ScrollArea>
        </SectionCard>
    );
}
