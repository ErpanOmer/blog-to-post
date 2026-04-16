import { ArrowLeft, Loader2, Rocket, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleEditor } from "@/react-app/components/ArticleEditor";
import { GenerationPanel } from "@/react-app/components/GenerationPanel";
import { TitleGenerator } from "@/react-app/components/TitleGenerator";
import type { Article } from "@/react-app/types";

interface ArticleEditorPageProps {
  draft: Article | null;
  isGenerating: boolean;
  isSaving: boolean;
  isFormValid: boolean;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onArticleUpdate: (updates: Partial<Article>) => void;
  onSave: () => void;
  onQuickPublish: () => void;
}

export function ArticleEditorPage({
  draft,
  isGenerating,
  isSaving,
  isFormValid,
  onBack,
  onTitleChange,
  onArticleUpdate,
  onSave,
  onQuickPublish,
}: ArticleEditorPageProps) {
  const hasTitle = Boolean(draft?.title?.trim());

  return (
    <div className="surface-panel overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="secondary" size="sm" type="button" onClick={onBack} className="mt-0.5 gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>

            <div className="icon-tile h-10 w-10 rounded-xl">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="eyebrow-label mb-1">Editor Workspace</p>
              <h1 className="text-lg font-semibold text-slate-900">文章编辑工作台</h1>
              <p className="mt-1 text-sm text-slate-500">
                左侧维护标题、摘要、封面和标签，右侧专注正文编辑，结构更接近工具平台的工作流布局。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {hasTitle ? "当前草稿可继续编辑或直接分发" : "先填写标题，再完善封面与正文"}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={!isFormValid || isSaving || isGenerating}
              type="button"
              className="gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存草稿
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onQuickPublish}
              disabled={!isFormValid || isSaving || isGenerating}
              type="button"
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              快速发布
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-14rem)] grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50/80 p-4 xl:border-b-0 xl:border-r xl:p-5">
          <div className="space-y-4">
            <TitleGenerator title={draft?.title ?? ""} onTitleChange={onTitleChange} disabled={isGenerating} hideAIActions />
            <GenerationPanel article={draft} onArticleUpdate={onArticleUpdate} disabled={isGenerating} hideAIActions />
          </div>
        </aside>

        <section className="min-w-0 bg-white p-4 md:p-5">
          <ArticleEditor article={draft} onChange={(article) => onArticleUpdate(article)} disabled={isGenerating} hideAIActions />
        </section>
      </div>
    </div>
  );
}
