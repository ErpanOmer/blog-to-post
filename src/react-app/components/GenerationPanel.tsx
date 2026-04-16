import { useRef, useState } from "react";
import {
  AlignLeft,
  CheckCircle2,
  Image,
  Lightbulb,
  Link2,
  Loader2,
  Tags,
  Upload,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateCover, generateSummary } from "@/react-app/api";
import type { ArticleSummary } from "@/react-app/api";
import { uploadImageToImageHosting } from "@/react-app/services/image-hosting";
import type { Article } from "@/react-app/types";

interface GenerationPanelProps {
  article: Article | null;
  onArticleUpdate: (payload: Partial<Article>) => void;
  disabled?: boolean;
  hideAIActions?: boolean;
}

export function GenerationPanel({
  article,
  onArticleUpdate,
  disabled,
  hideAIActions = false,
}: GenerationPanelProps) {
  const [loading, setLoading] = useState({
    summary: false,
    cover: false,
    uploadCover: false,
  });
  const [summaryData, setSummaryData] = useState<ArticleSummary | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerateSummary = async () => {
    if (!article?.content?.trim()) return;
    setLoading((prev) => ({ ...prev, summary: true }));

    try {
      const data = await generateSummary(article.content);
      setSummaryData(data);
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

  const handleUploadLocalCover = async (file: File | null) => {
    if (!file) return;

    setUploadError(null);
    setUploadMessage(null);
    setLoading((prev) => ({ ...prev, uploadCover: true }));

    try {
      const url = await uploadImageToImageHosting(file);
      onArticleUpdate({ coverImage: url });
      setUploadMessage("封面已上传，并自动填入图片地址。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "封面上传失败";
      setUploadError(message);
      console.error("上传封面失败", error);
    } finally {
      setLoading((prev) => ({ ...prev, uploadCover: false }));
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Image className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">封面图</p>
              <p className="text-xs text-slate-500">支持智能生成、手动粘贴链接和本地上传。</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hideAIActions && (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled || loading.cover || loading.uploadCover}
                onClick={handleGenerateCover}
                type="button"
                className="gap-2"
              >
                {loading.cover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                智能生成
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || loading.uploadCover}
              type="button"
              className="gap-2"
              onClick={() => coverFileInputRef.current?.click()}
            >
              {loading.uploadCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              上传图片
            </Button>

            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleUploadLocalCover(file);
              }}
            />
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Link2 className="h-3.5 w-3.5" />
          图片地址会直接作为发布封面使用。
        </div>

        <Input
          type="text"
          disabled={disabled}
          value={article?.coverImage ?? ""}
          onChange={(event) => article && onArticleUpdate({ coverImage: event.target.value })}
          placeholder="https://example.com/cover.png"
          className="mb-3"
        />

        <div className="h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {article?.coverImage ? (
            <img src={article.coverImage} alt="封面预览" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">封面预览会显示在这里</div>
          )}
        </div>

        {uploadMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {uploadMessage}
          </div>
        )}

        {uploadError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            封面上传失败: {uploadError}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <AlignLeft className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">文章摘要</p>
              <p className="text-xs text-slate-500">用于列表摘要和部分平台的描述字段。</p>
            </div>
          </div>

          {!hideAIActions && (
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || !article?.content?.trim() || loading.summary}
              onClick={handleGenerateSummary}
              type="button"
              className="gap-2"
            >
              {loading.summary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              智能生成
            </Button>
          )}
        </div>

        {!hideAIActions && summaryData && (
          <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                智能摘要建议
              </div>
              <p className="text-sm leading-6 text-slate-700">{summaryData.summary}</p>
            </div>

            {summaryData.tags.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">推荐标签</div>
                <div className="flex flex-wrap gap-1.5">
                  {summaryData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Textarea
          disabled={disabled}
          value={article?.summary ?? ""}
          onChange={(event) => article && onArticleUpdate({ summary: event.target.value })}
          placeholder="输入文章摘要"
          className="min-h-[88px] resize-none"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Tags className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">文章标签</p>
            <p className="text-xs text-slate-500">多个标签用逗号分隔，便于后续分发和筛选。</p>
          </div>
        </div>

        <Input
          type="text"
          disabled={disabled}
          value={article?.tags?.join(", ") ?? ""}
          onChange={(event) => {
            if (!article) return;
            onArticleUpdate({
              tags: event.target.value
                .split(/[,，、]/)
                .map((item) => item.trim())
                .filter(Boolean),
            });
          }}
          placeholder="性能优化, React, 工程化"
        />
      </section>
    </div>
  );
}
