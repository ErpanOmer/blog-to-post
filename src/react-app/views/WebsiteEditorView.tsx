import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { marked } from "marked";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ExternalLink, Image, Loader2, Save, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArticleEditor } from "@/react-app/components/ArticleEditor";
import { EditableTagInput } from "@/react-app/components/EditableTagInput";
import {
  getWebsitePost,
  publishWebsitePost,
  unpublishWebsitePost,
  updateWebsitePost,
  type WebsitePost,
  type WebsitePostPayload,
  type WebsiteSource,
} from "@/react-app/api";
import { uploadImageToImageHosting } from "@/react-app/services/image-hosting";
import type { Article } from "@/react-app/types";

type DraftState = {
  slug: string;
  title: string;
  description: string;
  markdownContent: string;
  cover: string;
  tags: string[];
  draft: boolean;
  url?: string;
  pubDate?: string;
  lastModified?: string | null;
};

function isLocalWebsiteDashboard(): boolean {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function normalizeWebsiteSource(value: string | null): WebsiteSource {
  if (isLocalWebsiteDashboard() && value === "local") return "local";
  if (isLocalWebsiteDashboard() && value !== "remote") return "local";
  return "remote";
}

function postToDraft(post: WebsitePost): DraftState {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description ?? "",
    markdownContent: post.markdownContent ?? "",
    cover: post.cover ?? "",
    tags: post.tags ?? [],
    draft: post.draft,
    url: post.url || post.publishedUrl,
    pubDate: post.pubDate,
    lastModified: post.lastModified,
  };
}

async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const result = marked.parse(markdown || "");
  return typeof result === "string" ? result : await result;
}

function buildEditorArticle(draft: DraftState): Article {
  return {
    id: draft.slug,
    title: draft.title,
    content: draft.markdownContent,
    summary: draft.description,
    tags: draft.tags,
    coverImage: draft.cover,
    platform: "website",
    status: "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function WebsiteEditorView() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slugParam = params.slug;
  const source = normalizeWebsiteSource(searchParams.get("source"));

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("尚未保存本次修改");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverMessage, setCoverMessage] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editorArticle = useMemo(() => draft ? buildEditorArticle(draft) : null, [draft]);
  const isMutating = isSaving || isStatusUpdating || isUploadingCover;

  useEffect(() => {
    if (!slugParam) {
      navigate("/website", { replace: true });
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const post = await getWebsitePost(slugParam, source);
        if (!cancelled) setDraft(postToDraft(post));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载个人网站文章失败");
        navigate("/website");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, slugParam, source]);

  const buildPayload = async (nextDraft = draft): Promise<Partial<WebsitePostPayload>> => {
    if (!nextDraft) throw new Error("文章未加载完成");
    const markdownContent = nextDraft.markdownContent.trim();
    return {
      title: nextDraft.title.trim(),
      description: nextDraft.description.trim() || nextDraft.title.trim(),
      markdownContent,
      htmlContent: await renderMarkdownToHtml(markdownContent),
      lastModified: new Date().toISOString(),
      draft: nextDraft.draft,
      tags: nextDraft.tags,
      cover: nextDraft.cover.trim() || undefined,
    };
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("请先填写标题");
      return;
    }

    setIsSaving(true);
    setSaveState("saving");
    setStatusMessage("正在保存文章...");
    try {
      const payload = await buildPayload();
      const result = await updateWebsitePost(draft.slug, payload, source);
      const savedAt = new Date();
      toast.success("个人网站文章已保存");
      setSaveState("saved");
      setStatusMessage(`已保存 ${savedAt.toLocaleTimeString()}`);
      setDraft((prev) => prev ? {
        ...prev,
        draft: result.draft ?? prev.draft,
        url: result.url || result.publishedUrl || prev.url,
        lastModified: savedAt.toISOString(),
      } : prev);
    } catch (error) {
      setSaveState("error");
      setStatusMessage(error instanceof Error ? error.message : "保存失败");
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDraft = async (nextDraft: boolean) => {
    if (!draft) return;
    setIsStatusUpdating(true);
    setSaveState("saving");
    setStatusMessage(nextDraft ? "正在转为草稿..." : "正在发布文章...");
    try {
      await updateWebsitePost(draft.slug, await buildPayload({ ...draft, draft: nextDraft }), source);
      if (nextDraft) {
        await unpublishWebsitePost(draft.slug, source);
        toast.success("已转为草稿");
      } else {
        await publishWebsitePost(draft.slug, source);
        toast.success("已发布到个人网站");
      }
      const savedAt = new Date();
      setSaveState("saved");
      setStatusMessage(nextDraft ? `已转为草稿 ${savedAt.toLocaleTimeString()}` : `已发布 ${savedAt.toLocaleTimeString()}`);
      setDraft((prev) => prev ? { ...prev, draft: nextDraft, lastModified: savedAt.toISOString() } : prev);
    } catch (error) {
      setSaveState("error");
      setStatusMessage(error instanceof Error ? error.message : "更新状态失败");
      toast.error(error instanceof Error ? error.message : "更新状态失败");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const openCoverPicker = () => {
    if (isMutating) return;
    fileInputRef.current?.click();
  };

  const handleUploadCover = async (file: File | null) => {
    if (!file || !draft) return;
    setCoverError(null);
    setCoverMessage(null);
    setIsUploadingCover(true);
    setStatusMessage("正在上传封面...");
    try {
      const url = await uploadImageToImageHosting(file);
      setDraft((prev) => prev ? { ...prev, cover: url } : prev);
      setCoverMessage("封面已上传，并自动填入图片地址");
      setStatusMessage("封面已上传，记得保存文章");
    } catch (error) {
      const message = error instanceof Error ? error.message : "封面上传失败";
      setCoverError(message);
      setStatusMessage(message);
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-design-neutral" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-design-background page-enter flex-1">
      <div className="shrink-0 border-b border-design-border bg-white/85 px-4 py-2.5 backdrop-blur-xl md:px-5">
        <div className="mx-auto flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => navigate("/website")} className="gap-1.5 text-design-textSecondary hover:text-design-text">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">返回列表</span>
            </Button>
            <div className="h-4 w-px bg-design-border" />
            <div className="min-w-0">
              <h1 className="truncate text-[14px] font-semibold text-design-text">{draft.title || "编辑个人网站文章"}</h1>
              <p className="truncate text-[12px] text-design-neutral">slug 固定为 {draft.slug}，当前编辑 {source === "local" ? "本地" : "线上"}个人网站文章。</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={saveState === "error" ? "destructive" : "outline"}
              className="hidden max-w-[240px] truncate rounded-full bg-white px-3 py-1.5 text-[12px] font-normal text-design-textSecondary md:inline-flex"
            >
              {isSaving || isStatusUpdating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
              {statusMessage}
            </Badge>
            <div className="hidden items-center gap-2 rounded-lg border border-design-border bg-white px-3 py-1.5 text-[13px] text-design-textSecondary md:flex">
              {isStatusUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" /> : null}
              <span>{draft.draft ? "草稿" : "正式"}</span>
              <Switch checked={!draft.draft} disabled={isMutating} onCheckedChange={(checked) => void handleToggleDraft(!checked)} />
            </div>
            {draft.url ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isMutating}
                onClick={() => window.open(draft.url, "_blank", "noopener,noreferrer")}
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                打开文章
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isMutating} className="gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? "保存中" : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[clamp(380px,20vw,450px)_minmax(0,1fr)]">
        <aside className="space-y-3 overflow-y-auto border-r border-design-border bg-design-background p-4 custom-scrollbar">
          <div className="space-y-2">
            <Label>标题</Label>
            <Textarea disabled={isMutating} value={draft.title} onChange={(event) => setDraft((prev) => prev ? { ...prev, title: event.target.value } : prev)} className="min-h-[72px]" />
          </div>
          <div className="space-y-2 rounded-xl border border-design-border bg-white p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Image className="h-4 w-4" />
                </div>
                <Label className="text-[14px] font-semibold text-design-text">封面图</Label>
              </div>
              <Button variant="secondary" size="sm" disabled={isUploadingCover} type="button" className="h-8 gap-1.5 rounded-md px-3 text-[12px]" onClick={openCoverPicker}>
                {isUploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                上传
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUploadCover(event.target.files?.[0] ?? null)}
            />
            <Input disabled={isMutating} value={draft.cover} onChange={(event) => setDraft((prev) => prev ? { ...prev, cover: event.target.value } : prev)} placeholder="https://res.cloudinary.com/..." />
            <button
              type="button"
              disabled={isMutating}
              onClick={openCoverPicker}
              className="group relative mt-2 block aspect-[21/9] w-full overflow-hidden rounded-xl border border-dashed border-design-border bg-design-background text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed"
            >
              {draft.cover ? (
                <>
                  <img src={draft.cover} alt="封面预览" className="h-full w-full object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-[13px] font-medium text-white opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
                    点击更换封面
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[13px] text-design-textSecondary">
                  {isUploadingCover ? <Loader2 className="h-5 w-5 animate-spin text-brand-500" /> : <Upload className="h-5 w-5 text-design-neutral transition-colors group-hover:text-brand-500" />}
                  <span>{isUploadingCover ? "封面上传中..." : "点击上传本地图片"}</span>
                </div>
              )}
            </button>
            {coverMessage ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {coverMessage}
              </div>
            ) : null}
            {coverError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                封面上传失败: {coverError}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>摘要</Label>
            <Textarea disabled={isMutating} value={draft.description} onChange={(event) => setDraft((prev) => prev ? { ...prev, description: event.target.value } : prev)} className="min-h-[84px]" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>标签</Label>
            <EditableTagInput tags={draft.tags} disabled={isMutating} onChange={(tags) => setDraft((prev) => prev ? { ...prev, tags } : prev)} />
          </div>
          <div className="rounded-lg border border-design-border bg-white px-3 py-2 text-[13px] leading-5 text-design-textSecondary">
            <p>发布时间由个人网站分发成功时自动写入，编辑页不再手动修改。</p>
            <p className="mt-1">Slug 固定：<span className="font-mono text-design-text">{draft.slug}</span></p>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden bg-white p-4 lg:p-5 xl:p-6">
          <ArticleEditor
            article={editorArticle}
            onChange={(article) => setDraft((prev) => prev ? { ...prev, markdownContent: article.content } : prev)}
            disabled={isMutating}
            hideAIActions
          />
        </section>
      </div>
    </div>
  );
}
