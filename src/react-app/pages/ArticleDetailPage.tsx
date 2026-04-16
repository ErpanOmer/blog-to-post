import { Viewer } from "@bytemd/react";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import math from "@bytemd/plugin-math";
import "bytemd/dist/index.css";
import "highlight.js/styles/github.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArticlePublicationStatus } from "@/react-app/components/ArticlePublicationStatus";
import type { Article } from "@/react-app/types";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  ImageIcon,
  Pencil,
  Rocket,
  Trash2,
} from "lucide-react";

interface ArticleDetailPageProps {
  article: Article;
  onBack: () => void;
  onEdit?: (article: Article) => void;
  onDelete?: (article: Article) => void;
  onPublish?: (articles: Article[]) => void;
}

const plugins = [gfm(), highlight(), breaks(), frontmatter(), gemoji(), math()];

const statusConfig = {
  draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
  reviewed: { label: "待审核", className: "bg-sky-100 text-sky-700" },
  scheduled: { label: "待发布", className: "bg-amber-100 text-amber-700" },
  published: { label: "已发布", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "发布失败", className: "bg-rose-100 text-rose-700" },
} as const;

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ArticleDetailPage({ article, onBack, onEdit, onDelete, onPublish }: ArticleDetailPageProps) {
  const status = statusConfig[article.status];

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 md:w-56">
              {article.coverImage ? (
                <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={cn("border-0", status.className)}>{status.label}</Badge>
                <Badge variant="outline">创建于 {formatDateTime(article.createdAt)}</Badge>
                <Badge variant="outline">更新于 {formatDateTime(article.updatedAt)}</Badge>
              </div>

              <h1 className="text-[28px] font-semibold leading-tight text-slate-900">{article.title || "未命名文章"}</h1>
              {article.summary && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{article.summary}</p>}

              {article.tags && article.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {article.tags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="outline" className="gap-1.5">
                      <Hash className="h-3 w-3 text-slate-400" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
            <Button variant="default" size="sm" type="button" onClick={() => onPublish?.([article])} className="gap-2">
              <Rocket className="h-4 w-4" />
              发布文章
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => onEdit?.(article)}
              disabled={article.status !== "draft"}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onDelete?.(article)}
              disabled={article.status !== "draft"}
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-panel p-6">
          <ArticlePublicationStatus articleId={article.id} />
          <Separator className="my-6 bg-slate-200" />
          <div className="prose prose-slate max-w-none">
            <div className="bytemd-viewer">
              <Viewer value={article.content} plugins={plugins} />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface-panel p-5">
            <p className="eyebrow-label mb-2">Timeline</p>
            <h2 className="text-lg font-semibold text-slate-900">时间信息</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Calendar className="h-4 w-4 text-brand-600" />
                  创建时间
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(article.createdAt)}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Clock className="h-4 w-4 text-slate-600" />
                  最近更新时间
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(article.updatedAt)}</p>
              </div>

              {article.publishedAt && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    发布时间
                  </div>
                  <p className="mt-2 text-xs text-emerald-700">{formatDateTime(article.publishedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {article.summary && (
            <div className="surface-panel p-5">
              <p className="eyebrow-label mb-2">Summary</p>
              <h2 className="text-lg font-semibold text-slate-900">摘要</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{article.summary}</p>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="surface-panel p-5">
              <p className="eyebrow-label mb-2">Tags</p>
              <h2 className="text-lg font-semibold text-slate-900">标签</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {article.tags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="outline" className="gap-1.5">
                    <FileText className="h-3 w-3 text-slate-400" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
