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
      <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-stone-200 bg-stone-50/65 px-6 py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-brand shadow-glow">
          <FileText className="h-10 w-10 text-white" />
        </div>
        <h3 className="font-display text-3xl font-semibold text-slate-900">还没有文章</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">点右上角的新建文章开始积累内容。后面无论是草稿沉淀、批量发布还是追踪结果，都会从这里展开。</p>
        <div className="mt-5 flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50/70 px-4 py-2 text-xs text-brand-700">
          <Sparkles className="h-3.5 w-3.5" />
          支持草稿保存、快速发布和多平台分发
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-subtle flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow-label mb-2">Articles</p>
          <p className="text-sm text-slate-600">这里是文章库存中心，适合做筛选、查看详情、批量分发和草稿编辑。</p>
        </div>

        {!isBatchMode ? (
          <Button variant="outline" size="sm" onClick={toggleBatchMode} className="gap-2 self-start md:self-auto">
            <CheckSquare className="h-4 w-4" />
            批量选择
          </Button>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={toggleSelectAll} className="gap-2">
                {selectedIds.size === articles.length ? (
                  <>
                    <Square className="h-4 w-4" />
                    取消全选
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    全选
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleBatchMode} className="gap-2">
                <X className="h-4 w-4" />
                退出批量
              </Button>
            </div>

            {selectedArticles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  已选 <span className="font-semibold text-slate-800">{selectedArticles.length}</span> 篇文章
                </span>
                <Button variant="gradient" size="sm" onClick={handleBatchPublish} className="gap-2">
                  <Layers className="h-4 w-4" />
                  批量发布
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {articles.map((article) => {
        const isDraft = article.status === "draft";
        const isSelected = selectedIds.has(article.id);

        return (
          <article
            key={article.id}
            className={cn(
              "group relative overflow-hidden rounded-[28px] border border-white/75 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(248,243,236,0.86))] p-5 shadow-card transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-card-hover",
              isBatchMode && isSelected && "border-brand-300 ring-2 ring-brand-500/25",
            )}
          >
            <div
              className={cn(
                "absolute left-0 top-6 h-[calc(100%-3rem)] w-1.5 rounded-full",
                article.status === "published" && "bg-gradient-to-b from-emerald-400 to-emerald-600",
                article.status === "draft" && "bg-gradient-to-b from-slate-300 to-slate-500",
                article.status === "reviewed" && "bg-gradient-to-b from-sky-400 to-sky-600",
                article.status === "scheduled" && "bg-gradient-to-b from-amber-400 to-sunset-500",
                article.status === "failed" && "bg-gradient-to-b from-rose-400 to-red-600",
              )}
            />

            <div className="flex flex-col gap-5 pl-3 md:flex-row">
              {isBatchMode && (
                <div className="flex items-start pt-2">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleArticle(article.id)} className="h-5 w-5" />
                </div>
              )}

              <button
                className="relative block w-full flex-shrink-0 overflow-hidden rounded-[24px] border border-white/70 md:w-[240px]"
                onClick={() => !isBatchMode && onViewDetail(article)}
                type="button"
              >
                {article.coverImage ? (
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] md:h-40"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center bg-stone-100 md:h-40">
                    <ImageIcon className="h-12 w-12 text-stone-300" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={article.status} />
                      <span className="rounded-full border border-stone-200 bg-white/75 px-3 py-1 text-[11px] font-medium text-slate-500">
                        更新于 {getRelativeTime(article.updatedAt)}
                      </span>
                    </div>
                    <h3
                      className="line-clamp-2 cursor-pointer font-display text-[1.7rem] font-semibold leading-tight text-slate-900 transition-colors group-hover:text-brand-700"
                      onClick={() => !isBatchMode && onViewDetail(article)}
                    >
                      {article.title || "未命名文章"}
                    </h3>
                    {article.summary && <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-relaxed text-slate-600">{article.summary}</p>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    最近修改 {getRelativeTime(article.updatedAt)}
                  </span>

                  {article.publishedAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-emerald-700">
                      <Calendar className="h-3.5 w-3.5" />
                      发布时间 {formatDateTime(article.publishedAt)}
                    </span>
                  )}

                  {article.tags?.slice(0, 3).map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50/80 px-3 py-1.5 text-[11px] font-medium text-slate-600"
                    >
                      <Hash className="h-3 w-3 text-slate-400" />
                      {tag}
                    </span>
                  ))}

                  {article.tags && article.tags.length > 3 && (
                    <span className="rounded-full border border-stone-200 bg-white/75 px-3 py-1.5 text-[11px] text-slate-500">
                      +{article.tags.length - 3} 个标签
                    </span>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-4 border-t border-stone-200/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <ArticlePublicationStatus articleId={article.id} />
                  </div>

                  {!isBatchMode && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="gradient" size="sm" className="gap-2" onClick={() => onPublish?.([article])}>
                        <Send className="h-4 w-4" />
                        发布
                      </Button>

                      <Button variant="secondary" size="sm" className="gap-2" onClick={() => onViewDetail(article)}>
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>

                      {isDraft && (
                        <>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit?.(article)}>
                            <Pencil className="h-4 w-4" />
                            编辑
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete?.(article)}>
                            <Trash2 className="h-4 w-4" />
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
