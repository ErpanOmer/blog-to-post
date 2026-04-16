import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Article } from "@/react-app/types";
import { ArticlePublicationStatus } from "./ArticlePublicationStatus";
import { StatusBadge } from "./StatusBadge";
import {
  Calendar,
  CheckSquare,
  Clock,
  Eye,
  FileText,
  Hash,
  ImageIcon,
  Layers,
  Pencil,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";

interface ArticleListProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit?: (article: Article) => void;
  onDelete?: (article: Article) => void;
  onPublish?: (articles: Article[]) => void;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return formatDateTime(timestamp);
}

export function ArticleList({ articles, onViewDetail, onEdit, onDelete, onPublish }: ArticleListProps) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedArticles = useMemo(() => {
    return articles.filter((article) => selectedIds.has(article.id));
  }, [articles, selectedIds]);

  const toggleBatchMode = () => {
    setIsBatchMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleArticle = (articleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map((article) => article.id)));
    }
  };

  const handleBatchPublish = () => {
    if (selectedArticles.length === 0) return;
    onPublish?.(selectedArticles);
    setIsBatchMode(false);
    setSelectedIds(new Set());
  };

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">还没有文章</h3>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">点右上角的新建文章开始积累内容。</p>
        <div className="mt-4 flex items-center gap-1.5 rounded-md border border-brand-200/60 bg-brand-50 px-3 py-1.5 text-[11px] font-medium text-brand-600">
          <Sparkles className="h-3 w-3" />
          支持草稿保存、快速发布和多平台分发
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-slate-500">
          共 <span className="font-medium text-slate-700">{articles.length}</span> 篇文章
        </p>

        {!isBatchMode ? (
          <Button variant="outline" size="xs" onClick={toggleBatchMode} className="gap-1.5 self-start md:self-auto">
            <CheckSquare className="h-3.5 w-3.5" />
            批量选择
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="xs" onClick={toggleSelectAll} className="gap-1.5">
              {selectedIds.size === articles.length ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  取消全选
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  全选
                </>
              )}
            </Button>
            <Button variant="ghost" size="xs" onClick={toggleBatchMode} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              退出
            </Button>

            {selectedArticles.length > 0 && (
              <>
                <span className="text-[11px] text-slate-400">
                  已选 <span className="font-medium text-slate-700">{selectedArticles.length}</span> 篇
                </span>
                <Button variant="default" size="xs" onClick={handleBatchPublish} className="gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  批量发布
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Article items */}
      {articles.map((article) => {
        const isDraft = article.status === "draft";
        const isSelected = selectedIds.has(article.id);

        return (
          <article
            key={article.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-200",
              "hover:border-slate-300/80 hover:shadow-card-hover",
              isBatchMode && isSelected && "border-brand-300 ring-2 ring-brand-500/20 bg-brand-50/30",
            )}
          >
            <div className="flex flex-col gap-4 md:flex-row">
              {isBatchMode && (
                <div className="flex items-start pt-1">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleArticle(article.id)} className="h-4 w-4" />
                </div>
              )}

              {/* Cover image */}
              <button
                className="relative block w-full flex-shrink-0 overflow-hidden rounded-lg md:w-[200px]"
                onClick={() => !isBatchMode && onViewDetail(article)}
                type="button"
              >
                {article.coverImage ? (
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] md:h-32"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-slate-50 md:h-32">
                    <ImageIcon className="h-8 w-8 text-slate-200" />
                  </div>
                )}
              </button>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={article.status} />
                      <span className="text-[11px] text-slate-400">
                        {getRelativeTime(article.updatedAt)}
                      </span>
                    </div>
                    <h3
                      className="line-clamp-2 cursor-pointer text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-600"
                      onClick={() => !isBatchMode && onViewDetail(article)}
                    >
                      {article.title || "未命名文章"}
                    </h3>
                    {article.summary && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{article.summary}</p>}
                  </div>
                </div>

                {/* Meta tags */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {article.publishedAt && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(article.publishedAt)}
                    </span>
                  )}

                  {article.tags?.slice(0, 3).map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                    >
                      <Hash className="h-2.5 w-2.5 text-slate-400" />
                      {tag}
                    </span>
                  ))}

                  {article.tags && article.tags.length > 3 && (
                    <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] text-slate-400">
                      +{article.tags.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer with pub status and actions */}
                <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <ArticlePublicationStatus articleId={article.id} />
                  </div>

                  {!isBatchMode && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="default" size="xs" className="gap-1" onClick={() => onPublish?.([article])}>
                        <Send className="h-3 w-3" />
                        发布
                      </Button>

                      <Button variant="ghost" size="xs" className="gap-1 text-slate-500" onClick={() => onViewDetail(article)}>
                        <Eye className="h-3 w-3" />
                        查看
                      </Button>

                      {isDraft && (
                        <>
                          <Button variant="ghost" size="xs" className="gap-1 text-slate-500" onClick={() => onEdit?.(article)}>
                            <Pencil className="h-3 w-3" />
                            编辑
                          </Button>
                          <Button variant="ghost" size="xs" className="gap-1 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete?.(article)}>
                            <Trash2 className="h-3 w-3" />
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
