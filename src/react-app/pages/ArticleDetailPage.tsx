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
  draft: { label: "草稿", className: "bg-slate-50 text-slate-600 border-slate-200" },
  reviewed: { label: "待审核", className: "bg-sky-50 text-sky-600 border-sky-200/60" },
  scheduled: { label: "待发布", className: "bg-amber-50 text-amber-600 border-amber-200/60" },
  published: { label: "已发布", className: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  failed: { label: "发布失败", className: "bg-rose-50 text-rose-600 border-rose-200/60" },
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
    <div className="space-y-4 page-enter">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div className="h-28 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 md:w-44">
              {article.coverImage ? (
                <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-slate-200" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge className={cn("border text-[10px]", status.className)}>{status.label}</Badge>
                <span className="text-[11px] text-slate-400">创建于 {formatDateTime(article.createdAt)}</span>
                <span className="text-[11px] text-slate-400">· 更新于 {formatDateTime(article.updatedAt)}</span>
              </div>

              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{article.title || "未命名文章"}</h1>
              {article.summary && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">{article.summary}</p>}

              {article.tags && article.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {article.tags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="outline" className="gap-1 text-[10px]">
                      <Hash className="h-2.5 w-2.5 text-slate-400" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="xs" type="button" onClick={onBack} className="gap-1 text-slate-500">
              <ArrowLeft className="h-3 w-3" />
              返回
            </Button>
            <Button variant="default" size="xs" type="button" onClick={() => onPublish?.([article])} className="gap-1">
              <Rocket className="h-3 w-3" />
              发布
            </Button>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => onEdit?.(article)}
              disabled={article.status !== "draft"}
              className="gap-1 text-slate-500"
            >
              <Pencil className="h-3 w-3" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => onDelete?.(article)}
              disabled={article.status !== "draft"}
              className="gap-1 text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* Main content */}
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <ArticlePublicationStatus articleId={article.id} />
          <Separator className="my-5 bg-slate-100" />
          <div className="prose prose-slate max-w-none prose-headings:tracking-tight prose-p:text-[14px] prose-p:leading-relaxed">
            <div className="bytemd-viewer">
              <Viewer value={article.content} plugins={plugins} />
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <h2 className="text-[13px] font-semibold text-slate-800">时间信息</h2>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-brand-400" />
                  创建时间
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(article.createdAt)}</p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  最近更新
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(article.updatedAt)}</p>
              </div>

              {article.publishedAt && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    发布时间
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-600">{formatDateTime(article.publishedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {article.summary && (
            <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
              <h2 className="text-[13px] font-semibold text-slate-800">摘要</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{article.summary}</p>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
              <h2 className="text-[13px] font-semibold text-slate-800">标签</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {article.tags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="outline" className="gap-1 text-[10px]">
                    <FileText className="h-2.5 w-2.5 text-slate-400" />
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
