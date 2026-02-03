import type { Article } from "@/react-app/types";
import { StatusBadge } from "./StatusBadge";
import { ArticlePublicationStatus } from "./ArticlePublicationStatus";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Calendar, 
  Hash, 
  Clock, 
  ImageIcon, 
  Eye, 
  Pencil, 
  Trash2,
  Sparkles,
  Send,
  CheckSquare,
  Square,
  Layers,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useMemo } from "react";

interface ArticleListProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit?: (article: Article) => void;
  onDelete?: (article: Article) => void;
  onPublish?: (articles: Article[]) => void;
}

const platformLabels: Record<string, string> = {
  juejin: "掘金",
  zhihu: "知乎",
  xiaohongshu: "小红书",
  wechat: "公众号",
};

const platformIcons: Record<string, string> = {
  juejin: "🔥",
  zhihu: "💡",
  xiaohongshu: "📕",
  wechat: "💬",
};

// 格式化日期时间（精确到时分秒）
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 获取相对时间
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return formatDateTime(timestamp);
}

export function ArticleList({ articles, onViewDetail, onEdit, onDelete, onPublish }: ArticleListProps) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 计算选中的文章
  const selectedArticles = useMemo(() => {
    return articles.filter(a => selectedIds.has(a.id));
  }, [articles, selectedIds]);

  // 切换批量模式
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedIds(new Set()); // 退出批量模式时清空选择
  };

  // 切换单篇文章选择
  const toggleArticle = (articleId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(a => a.id)));
    }
  };

  // 处理批量发布
  const handleBatchPublish = () => {
    if (selectedArticles.length === 0) return;
    onPublish?.(selectedArticles);
    setIsBatchMode(false);
    setSelectedIds(new Set());
  };

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
          <FileText className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无文章</h3>
        <p className="text-sm text-slate-400 mb-6">开始创作你的第一篇文章吧</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <span>点击右上角"生成文章"开始创作</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 批量操作工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {!isBatchMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleBatchMode}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              批量选择
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-2"
              >
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
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBatchMode}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                退出批量
              </Button>
            </div>
          )}
        </div>

        {/* 批量操作按钮 */}
        {isBatchMode && selectedArticles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              已选择 <span className="font-medium text-slate-700">{selectedArticles.length}</span> 篇文章
            </span>
            <Button
              variant="gradient"
              size="sm"
              onClick={handleBatchPublish}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              批量发布
            </Button>
          </div>
        )}
      </div>

      {articles.map((article) => {
        const isDraft = article.status === 'draft';
        const isSelected = selectedIds.has(article.id);
        
        return (
          <div
            key={article.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white",
              "transition-all duration-300 ease-out",
              "hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-brand-200",
              isBatchMode && isSelected && "ring-2 ring-brand-500 border-brand-300"
            )}
          >
            {/* 左侧状态指示条 */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300",
              article.status === 'published' && "bg-gradient-to-b from-emerald-400 to-emerald-600",
              article.status === 'draft' && "bg-gradient-to-b from-slate-300 to-slate-400",
              article.status === 'reviewed' && "bg-gradient-to-b from-blue-400 to-blue-600",
              article.status === 'scheduled' && "bg-gradient-to-b from-amber-400 to-amber-600",
              article.status === 'failed' && "bg-gradient-to-b from-red-400 to-red-600",
            )} />

            <div className="flex gap-4 p-5 pl-6">
              {/* 批量选择复选框 */}
              {isBatchMode && (
                <div className="flex items-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleArticle(article.id)}
                    className="h-5 w-5"
                  />
                </div>
              )}

              {/* 封面图 */}
              <div className="flex-shrink-0">
                <div 
                  className="relative group/cover cursor-pointer"
                  onClick={() => !isBatchMode && onViewDetail(article)}
                >
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className="h-28 w-44 rounded-xl object-cover shadow-md transition-all duration-300 group-hover/cover:scale-105 group-hover/cover:shadow-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-28 w-44 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
                      <ImageIcon className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                  {/* 平台标识（仅发布状态） */}
                  {article.status === 'published' && article.platform && (
                    <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-base border border-slate-100">
                      {platformIcons[article.platform]}
                    </div>
                  )}
                </div>
              </div>

              {/* 内容区域 */}
              <div className="flex flex-1 flex-col min-w-0">
                {/* 标题行 */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 
                    className="text-lg font-semibold text-slate-800 line-clamp-1 group-hover:text-brand-600 transition-colors cursor-pointer"
                    onClick={() => !isBatchMode && onViewDetail(article)}
                  >
                    {article.title || "未命名文章"}
                  </h3>
                  <StatusBadge status={article.status} />
                </div>

                {/* 摘要 */}
                {article.summary && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {article.summary}
                  </p>
                )}

                {/* 底部信息栏 */}
                <div className="mt-auto space-y-2">
                  {/* 第一行：时间和标签 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                      {/* 时间 */}
                      <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{getRelativeTime(article.updatedAt)}</span>
                      </div>

                      {/* 发布时间（仅已发布） */}
                      {article.publishedAt && (
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDateTime(article.publishedAt)}</span>
                        </div>
                      )}

                      {/* 标签 */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-slate-300" />
                          <div className="flex items-center gap-1.5">
                            {article.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-brand-100 hover:text-brand-700 transition-colors cursor-default"
                              >
                                {tag}
                              </span>
                            ))}
                            {article.tags.length > 3 && (
                              <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                                +{article.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 右侧：操作按钮（仅在非批量模式下显示） */}
                    {!isBatchMode && (
                      <div className="flex items-center gap-1">
                        {/* 发布按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-3 text-xs gap-1.5 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                          onClick={() => onPublish?.([article])}
                        >
                          <Send className="h-4 w-4" />
                          发布
                        </Button>

                        {/* 查看按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-3 text-xs gap-1.5 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                          onClick={() => onViewDetail(article)}
                        >
                          <Eye className="h-4 w-4" />
                          查看
                        </Button>

                        {/* 草稿状态显示编辑和删除 */}
                        {isDraft && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-xs gap-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              onClick={() => onEdit?.(article)}
                            >
                              <Pencil className="h-4 w-4" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-xs gap-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => onDelete?.(article)}
                            >
                              <Trash2 className="h-4 w-4" />
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 第二行：发布状态 */}
                  <div className="flex items-center">
                    <ArticlePublicationStatus articleId={article.id} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
