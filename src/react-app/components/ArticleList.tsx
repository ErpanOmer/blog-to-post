import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Article, PlatformType } from "@/react-app/types";
import type { ArticlePublication } from "@/react-app/types/publications";
import { ArticlePublicationStatus } from "./ArticlePublicationStatus";
import { PlatformBadge } from "@/react-app/components/PlatformBrand";
import { getPlatformDisplayName } from "@/react-app/components/platform-brand-data";
import { PUBLISHABLE_PLATFORMS, isPublishablePlatform } from "@/shared/platform-settings";
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
  onDeleteMany?: (articles: Article[]) => void;
  onPublish?: (articles: Article[]) => void;
  publicationRefreshKey?: number;
  publicationHistory?: ArticlePublication[];
}

type SortValue = "createdAt:desc" | "createdAt:asc" | "updatedAt:desc" | "updatedAt:asc" | "title:asc";

const PAGE_SIZE = 20;

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
  const diff = Date.now() - timestamp;
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
  return Boolean(platform) && isPublishablePlatform(platform);
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

export function ArticleList({
  articles,
  onViewDetail,
  onEdit,
  onDelete,
  onDeleteMany,
  onPublish,
  publicationRefreshKey = 0,
  publicationHistory = [],
}: ArticleListProps) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Exclude<PlatformType, "">>>(new Set());
  const [sortValue, setSortValue] = useState<SortValue>("createdAt:desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const publicationsByArticleId = useMemo(() => {
    const map = new Map<string, ArticlePublication[]>();
    publicationHistory.forEach((publication) => {
      const current = map.get(publication.articleId) ?? [];
      current.push(publication);
      map.set(publication.articleId, current);
    });
    return map;
  }, [publicationHistory]);

  const hasPublicationHistory = publicationHistory.length > 0;

  const platformOptions = useMemo(() => {
    const counts = new Map<Exclude<PlatformType, "">, number>();
    const seenArticleIdsByPlatform = new Map<Exclude<PlatformType, "">, Set<string>>();

    if (publicationHistory.length > 0) {
      publicationHistory.forEach((publication) => {
        if (!isKnownPlatform(publication.platform)) return;
        const seen = seenArticleIdsByPlatform.get(publication.platform) ?? new Set<string>();
        seen.add(publication.articleId);
        seenArticleIdsByPlatform.set(publication.platform, seen);
      });
      seenArticleIdsByPlatform.forEach((seen, platform) => counts.set(platform, seen.size));
    } else {
      articles.forEach((article) => {
        if (!isKnownPlatform(article.platform)) return;
        counts.set(article.platform, (counts.get(article.platform) ?? 0) + 1);
      });
    }

    return PUBLISHABLE_PLATFORMS
      .map((platform) => ({
        platform,
        label: getPlatformDisplayName(platform),
        count: counts.get(platform) ?? 0,
      }))
      .filter((item) => item.count > 0);
  }, [articles, publicationHistory]);

  const filteredArticles = useMemo(() => {
    const filtered = selectedPlatforms.size === 0
      ? articles
      : articles.filter((article) => {
        if (!hasPublicationHistory) {
          return isKnownPlatform(article.platform) && selectedPlatforms.has(article.platform);
        }

        const publications = publicationsByArticleId.get(article.id) ?? [];
        return publications.some((publication) => (
          isKnownPlatform(publication.platform) && selectedPlatforms.has(publication.platform)
        ));
      });

    return [...filtered].sort((a, b) => compareArticles(a, b, sortValue));
  }, [articles, hasPublicationHistory, publicationsByArticleId, selectedPlatforms, sortValue]);

  const visibleArticles = useMemo(
    () => filteredArticles.slice(0, visibleCount),
    [filteredArticles, visibleCount],
  );

  const hasMore = visibleCount < filteredArticles.length;

  const selectedArticles = useMemo(() => (
    articles.filter((article) => selectedIds.has(article.id))
  ), [articles, selectedIds]);

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
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  const togglePlatform = (platform: Exclude<PlatformType, "">) => {
    setVisibleCount(PAGE_SIZE);
    setSelectedIds(new Set());
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
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

  const handleBatchDelete = () => {
    if (selectedArticles.length === 0) return;
    onDeleteMany?.(selectedArticles);
    setIsBatchMode(false);
    setSelectedIds(new Set());
  };

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-design-border bg-design-background px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-brand-500 text-white">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <h3 className="font-display text-lg font-semibold text-design-text">还没有文章</h3>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-design-textSecondary">点击右上角的新建文章开始积累内容。</p>
        <div className="mt-4 flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-medium text-brand-600">
          <Sparkles className="h-3 w-3" />
          支持草稿保存、快速发布和多平台分发
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-design-border bg-white p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[13px] font-medium text-design-textSecondary">
              共 <span className="tabular-nums text-design-text">{filteredArticles.length}</span> 篇文章
              {filteredArticles.length !== articles.length ? <span className="ml-1 text-design-neutral">/ 全部 {articles.length}</span> : null}
            </p>
            <p className="mt-0.5 text-[12px] text-design-neutral">默认按创建时间倒序，每次加载 20 篇。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-design-border bg-white px-2.5 py-1.5 text-[12px] text-design-textSecondary">
              <SortDesc className="h-3.5 w-3.5 text-design-neutral" />
              <select
                value={sortValue}
                onChange={(event) => {
                  setVisibleCount(PAGE_SIZE);
                  setSelectedIds(new Set());
                  setSortValue(event.target.value as SortValue);
                }}
                className="bg-transparent text-[12px] font-medium text-design-textSecondary outline-none"
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
                    <span className="text-[12px] text-design-neutral">
                      已选 <span className="font-medium text-design-textSecondary">{selectedArticles.length}</span> 篇
                    </span>
                    <Button variant="default" size="xs" onClick={handleBatchPublish} className="gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      批量发布
                    </Button>
                    <Button variant="ghost" size="xs" onClick={handleBatchDelete} className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                      批量删除
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {platformOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-design-border pt-3">
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-design-textSecondary">
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
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-design-border bg-white text-design-textSecondary hover:bg-design-background hover:text-design-text",
                  )}
                  onClick={() => togglePlatform(item.platform)}
                >
                  {item.label} <span className={cn("ml-0.5", active ? "text-white/80" : "text-design-neutral")}>{item.count}</span>
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
                className="h-7 text-design-neutral"
              >
                清空筛选
              </Button>
            )}
          </div>
        )}
      </div>

      {filteredArticles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-design-border bg-design-background px-6 py-16 text-center text-[13px] text-design-neutral">
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
                  "group relative z-0 overflow-visible rounded-xl border border-design-border bg-white p-4",
                  "hover:z-30 focus-within:z-30",
                  isBatchMode && isSelected && "border-brand-300 bg-brand-50/30 ring-2 ring-brand-500/20",
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  {isBatchMode && (
                    <div className="flex items-start pt-1">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleArticle(article.id)} className="h-4 w-4" />
                    </div>
                  )}

                  <button
                    className="relative block w-full flex-shrink-0 overflow-hidden rounded-lg md:w-[260px] md:self-stretch lg:w-[280px]"
                    onClick={() => !isBatchMode && onViewDetail(article)}
                    type="button"
                  >
                    {article.coverImage ? (
                      <img
                        src={article.coverImage}
                        alt={article.title}
                        className="h-44 w-full object-cover md:h-full"
                        onError={(event) => {
                          (event.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center bg-design-background md:h-full">
                        <ImageIcon className="h-8 w-8 text-design-neutral" />
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          {isKnownPlatform(article.platform) && (
                            <PlatformBadge platform={article.platform} size="xs" />
                          )}
                          <span className="text-[12px] text-design-neutral">更新于 {getRelativeTime(article.updatedAt)}</span>
                          <span className="text-[12px] text-design-neutral">创建 {formatDateTime(article.createdAt)}</span>
                        </div>

                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <h3
                            className="line-clamp-2 min-w-0 flex-1 cursor-pointer text-base font-semibold leading-snug text-design-text transition-colors hover:text-brand-600"
                            onClick={() => !isBatchMode && onViewDetail(article)}
                          >
                            {article.title || "未命名文章"}
                          </h3>

                          {article.tags?.length ? (
                            <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1.5 lg:max-w-[48%] lg:justify-end">
                              {article.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={`${tag}-${index}`}
                                  className="inline-flex items-center gap-0.5 rounded-md border border-design-border bg-design-background px-2 py-0.5 text-[11px] font-medium text-design-textSecondary"
                                >
                                  <Hash className="h-2.5 w-2.5 text-design-neutral" />
                                  {tag}
                                </span>
                              ))}
                              {article.tags.length > 3 && (
                                <span className="rounded-md bg-design-background px-2 py-0.5 text-[11px] text-design-neutral">
                                  +{article.tags.length - 3}
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {article.summary && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-design-textSecondary">{article.summary}</p>}
                      </div>
                    </div>

                    {article.publishedAt && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(article.publishedAt)}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 border-t border-design-border pt-3">
                      <div className="min-w-0">
                        <ArticlePublicationStatus articleId={article.id} refreshKey={publicationRefreshKey} />
                      </div>

                      {!isBatchMode && (
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
                          <Button variant="default" size="xs" className="gap-1" onClick={() => onPublish?.([article])}>
                            <Send className="h-3 w-3" />
                            发布
                          </Button>

                          <Button variant="ghost" size="xs" className="gap-1 text-design-textSecondary" onClick={() => onViewDetail(article)}>
                            <Eye className="h-3 w-3" />
                            查看
                          </Button>

                          <Button variant="ghost" size="xs" className="gap-1 text-design-textSecondary" onClick={() => onEdit?.(article)}>
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
            <div className="py-3 text-center text-[12px] text-design-neutral">已经到底了</div>
          )}
        </>
      )}
    </div>
  );
}
