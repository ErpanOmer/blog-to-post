import type { Article } from "../types";
import { StatusBadge } from "./StatusBadge";
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
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArticleListProps {
  articles: Article[];
  onViewDetail: (article: Article) => void;
  onEdit?: (article: Article) => void;
  onDelete?: (article: Article) => void;
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

export function ArticleList({ articles, onViewDetail, onEdit, onDelete }: ArticleListProps) {
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
      {articles.map((article) => {
        const isDraft = article.status === 'draft';
        
        return (
          <div
            key={article.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white",
              "transition-all duration-300 ease-out",
              "hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-brand-200"
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
              {/* 封面图 */}
              <div className="flex-shrink-0">
                <div className="relative group/cover">
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
                  <h3 className="text-lg font-semibold text-slate-800 line-clamp-1 group-hover:text-brand-600 transition-colors">
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
                <div className="mt-auto flex items-center justify-between">
                  {/* 左侧：时间和标签 */}
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

                  {/* 右侧：操作按钮 */}
                  <div className="flex items-center gap-1">
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
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
