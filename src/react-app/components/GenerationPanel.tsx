import { useState } from "react";
import type { Article } from "../types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateCover, generateSummary } from "../api";
import type { ArticleSummary } from "../api";
import { 
  Image, 
  Tags, 
  AlignLeft,
  Loader2,
  Wand2,
  Lightbulb,
  Code2
} from "lucide-react";

interface GenerationPanelProps {
  article: Article | null;
  onArticleUpdate: (payload: Partial<Article>) => void;
  disabled?: boolean;
}

export function GenerationPanel({
  article,
  onArticleUpdate,
  disabled,
}: GenerationPanelProps) {
  const [loading, setLoading] = useState({
    summary: false,
    cover: false,
  });
  
  // 存储结构化摘要数据
  const [summaryData, setSummaryData] = useState<ArticleSummary | null>(null);

  const handleGenerateSummary = async () => {
    if (!article?.content?.trim()) return;
    setLoading((prev) => ({ ...prev, summary: true }));
    try {
      const data = await generateSummary(article.content);
      setSummaryData(data);
      // 将生成的摘要和标签存储到文章
      onArticleUpdate({ summary: data.summary, tags: data.tags });
    } catch (error) {
      console.error("生成摘要失败", error);
    } finally {
      setLoading((prev) => ({ ...prev, summary: false }));
    }
  };

  const handleGenerateCover = async () => {
    if (!article) return;
    setLoading((prev) => ({ ...prev, cover: true }));
    try {
      const { coverImage } = await generateCover(article.title, article.content);
      onArticleUpdate({ coverImage });
    } catch (error) {
      console.error("生成封面失败", error);
    } finally {
      setLoading((prev) => ({ ...prev, cover: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Cover Image */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Image className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-slate-900">封面图</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={disabled || loading.cover} 
            onClick={handleGenerateCover} 
            type="button"
            className="gap-2"
          >
            {loading.cover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            AI生成
          </Button>
        </div>
        
        <input
          type="text"
          disabled={disabled}
          value={article?.coverImage ?? ""}
          onChange={(e) => article && onArticleUpdate({ coverImage: e.target.value })}
          placeholder="https://example.com/cover.png"
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 mb-3"
        />
        
        <div className="h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {article?.coverImage ? (
            <img src={article.coverImage} alt="封面" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              <Image className="h-5 w-5 mr-2" />
              生成后将展示封面
            </div>
          )}
        </div>
      </div>

      {/* Summary - 摘要和标签展示 */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <AlignLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-slate-900">文章摘要</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={disabled || !article?.content?.trim() || loading.summary} 
            onClick={handleGenerateSummary} 
            type="button"
            className="gap-2"
          >
            {loading.summary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            AI生成
          </Button>
        </div>

        {/* 生成的摘要和标签展示 */}
        {summaryData && (
          <div className="space-y-3 mb-4">
            {/* AI生成的摘要 */}
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-slate-600">AI生成摘要</span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{summaryData.summary}</p>
            </div>

            {/* AI生成的标签 */}
            {summaryData.tags.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-slate-600">推荐标签</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summaryData.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 摘要编辑框 */}
        <Textarea
          disabled={disabled}
          value={article?.summary ?? ""}
          onChange={(event) => article && onArticleUpdate({ summary: event.target.value })}
          placeholder="请输入或生成文章摘要"
          className="min-h-[80px] resize-none rounded-lg border-slate-200 bg-slate-50/50 text-sm focus:bg-white disabled:opacity-50"
        />
      </div>

      {/* Tags - 仅保留手动输入 */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Tags className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">文章标签</span>
        </div>
        <input
          type="text"
          disabled={disabled}
          value={article?.tags?.join(", ") ?? ""}
          onChange={(event) => {
            if (!article) return;
            onArticleUpdate({
              tags: event.target.value
                .split(/[,，]/)
                .map((item) => item.trim())
                .filter(Boolean),
            });
          }}
          placeholder="性能优化, React, 工程化"
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
        />
        <p className="mt-2 text-[11px] text-slate-400">多个标签用逗号分隔，AI生成摘要时会自动推荐标签。</p>
      </div>
    </div>
  );
}
