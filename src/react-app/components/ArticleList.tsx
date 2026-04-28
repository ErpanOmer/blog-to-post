import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Article, PlatformType } from "@/react-app/types";
import { ArticlePublicationStatus } from "./ArticlePublicationStatus";
import {
  Calendar,
  CheckSquare,
  Eye,
  FileText,
  Filter,
  Hash,
  ImageIcon,
  Layers,
  Pencil,
  Send,
  SortDesc,
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

type SortValue = "createdAt:desc" | "createdAt:asc" | "updatedAt:desc" | "updatedAt:asc" | "title:asc";

const PAGE_SIZE = 20;

const platformLabels: Record<Exclude<PlatformType, "">, string> = {
  juejin: "掘金",
  zhihu: "知乎",
  wechat: "公众号",
  csdn: "CSDN",
  cnblogs: "博客园",
  segmentfault: "SegmentFault",
};

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

function isKnownPlatform(platform: PlatformType): platform is Exclude<PlatformType, ""> {
  return Boolean(platform) && platform in platformLabels;
}

function compareArticles(a: Article, b: Article, sortValue: SortValue): number {
  switch (sortValue) {
    case "createdAt:asc":
      return a.createdAt - b.createdAt;
    case "updatedAt:desc":
      return b.updatedAt - a.updatedAt;
    case "updatedAt:asc":
      return a.updatedAt - b.updatedAt;
    case "title:asc":
      return (a.title || "").localeCompare(b.title || "", "zh-CN");
    case "createdAt:desc":
    default:
      return b.createdAt - a.createdAt;
  }
}

export function ArticleList({ articles, onViewDetail, onEdit, onDelete, onPublish }: ArticleListProps) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Exclude<PlatformType, "">>>(new Set());
  const [sortValue, setSortValue] = useState<SortValue>("createdAt:desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const platformOptions = useMemo(() => {
    const counts = new Map<Exclude<PlatformType, "">, number>();
    articles.forEach((article) => {
      if (!isKnownPlatform(article.platform)) return;
      counts.set(article.platform, (counts.get(article.platform) ?? 0) + 1);
    });

    return Object.entries(platformLabels)
      .map(([platform, label]) => ({
        platform: platform as Exclude<PlatformType, "">,
        label,
        count: counts.get(platform as Exclude<PlatformType, "">) ?? 0,
      }))
      .filter((item) => item.count > 0);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const filtered = selectedPlatforms.size === 0
      ? articles
      : articles.filter((article) => isKnownPlatform(article.platform) && selectedPlatforms.has(article.platform));

    return [...filtered].sort((a, b) => compareArticles(a, b, sortValue));
  }, [articles, selectedPlatforms, sortValue]);

  const visibleArticles = useMemo(
    () => filteredArticles.slice(0, visibleCount),
    [filteredArticles, visibleCount],
  );

  const hasMore = visibleCount < filteredArticles.length;

  const selectedArticles = useMemo(() => {
    return articles.filter((article) => selectedIds.has(article.id));
  }, [articles, selectedIds]);

  useEffect(() => {
    if (!hasMore) return;

    const handleScroll = () => {
      const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (remaining < 360) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredArticles.length));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filteredArticles.length, hasMore]);

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

  const togglePlatform = (platform: Exclude<PlatformType, "">) => {
    setVisibleCount(PAGE_SIZE);
    setSelectedIds(new Set());
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map((article) => article.id)));
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
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">点击右上角的新建文章开始积累内容。</p>
        <div className="mt-4 flex items-center gap-1.5 rounded-md border border-brand-200/60 bg-brand-50 px-3 py-1.5 text-[11px] font-medium text-brand-600">
          <Sparkles className="h-3 w-3" />
          支持草稿保存、快速发布和多平台分发
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-700">
              共 <span className="tabular-nums text-slate-900">{filteredArticles.length}</span> 篇文章
              {filteredArticles.length !== articles.length ? <span className="ml-1 text-slate-400">/ 全部 {articles.length}</span> : null}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">默认按创建时间倒序，每次加载 20 篇。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-500 shadow-sm">
              <SortDesc className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortValue}
                onChange={(event) => {
                  setVisibleCount(PAGE_SIZE);
                  setSelectedIds(new Set());
                  setSortValue(event.target.value as SortValue);
                }}
                className="bg-transparent text-[12px] font-medium text-slate-700 outline-none"
              >
                <option value="createdAt:desc">创建时间倒序</option>
                <option value="createdAt:asc">创建时间正序</option>
                <option value="updatedAt:desc">修改时间倒序</option>
                <option value="updatedAt:asc">修改时间正序</option>
                <option value="title:asc">标题 A-Z</option>
              </select>
            </div>

            {!isBatchMode ? (
              <Button variant="outline" size="xs" onClick={toggleBatchMode} className="gap-1.5 self-start md:self-auto">
                <CheckSquare className="h-3.5 w-3.5" />
                批量选择
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="xs" onClick={toggleSelectAll} className="gap-1.5">
                  {selectedIds.size === filteredArticles.length ? (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      取消全选
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" />
                      全选当前筛选
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
        </div>

        {platformOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              平台筛选
            </span>
            {platformOptions.map((item) => {
              const active = selectedPlatforms.has(item.platform);
              return (
                <button
                  key={item.platform}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-brand-300 bg-brand-50 text-brand-600"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                  )}
                  onClick={() => togglePlatform(item.platform)}
                >
                  {item.label} <span className="ml-0.5 text-slate-400">{item.count}</span>
                </button>
              );
            })}
            {selectedPlatforms.size > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setVisibleCount(PAGE_SIZE);
                  setSelectedIds(new Set());
                  setSelectedPlatforms(new Set());
                }}
                className="h-7 text-slate-400"
              >
                清空筛选
              </Button>
            )}
          </div>
        )}
      </div>

      {filteredArticles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center text-[13px] text-slate-400">
          当前筛选下没有文章
        </div>
      ) : (
        <>
          {visibleArticles.map((article) => {
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

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          {isKnownPlatform(article.platform) && (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {platformLabels[article.platform]}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">更新于 {getRelativeTime(article.updatedAt)}</span>
                          <span className="text-[11px] text-slate-300">创建 {formatDateTime(article.createdAt)}</span>
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

                          <Button variant="ghost" size="xs" className="gap-1 text-slate-500" onClick={() => onEdit?.(article)}>
                            <Pencil className="h-3 w-3" />
                            编辑
                          </Button>
                          <Button variant="ghost" size="xs" className="gap-1 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete?.(article)}>
                            <Trash2 className="h-3 w-3" />
                            删除
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {hasMore ? (
            <div className="flex justify-center py-3">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredArticles.length))}>
                加载更多
              </Button>
            </div>
          ) : (
            <div className="py-3 text-center text-[11px] text-slate-400">已经到底了</div>
          )}
        </>
      )}
    </div>
  );
}
