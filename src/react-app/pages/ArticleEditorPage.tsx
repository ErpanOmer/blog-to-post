import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Rocket, Save, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArticleEditor } from "@/react-app/components/ArticleEditor";
import { ArticleAISettingsDialog } from "@/react-app/components/ArticleAISettingsDialog";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  // 保护机制：如果用户试图关闭页面或刷新，给出浏览器原生提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 修改状态追踪
  const handleUpdate = (updates: Partial<Article>) => {
    setHasUnsavedChanges(true);
    onArticleUpdate(updates);
  };

  const handleTitle = (title: string) => {
    setHasUnsavedChanges(true);
    onTitleChange(title);
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onBack();
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50 page-enter">
      {/* 沉浸式顶部栏 */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={handleBackClick} className="gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100/60">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">返回</span>
            </Button>

            <div className="h-4 w-px bg-slate-200" />

            <div className="icon-tile flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold text-slate-900 leading-tight">文章编辑工作台</h1>
              <p className="text-[11px] text-slate-400">
                {hasTitle ? "正在编辑并准备分发" : "请先输入一个好标题"}
                {hasUnsavedChanges && <span className="ml-2 text-amber-500 font-medium">* 有未保存的更改</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISettings(true)}
              disabled={isGenerating}
              type="button"
              className="gap-1.5 border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">AI 设置</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHasUnsavedChanges(false);
                onSave();
              }}
              disabled={!isFormValid || isSaving || isGenerating}
              type="button"
              className="gap-1.5 border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">保存草稿</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onQuickPublish}
              disabled={!isFormValid || isSaving || isGenerating}
              type="button"
              className="gap-1.5 shadow-sm"
            >
              <Rocket className="h-3.5 w-3.5" />
              快速发布
            </Button>
          </div>
        </div>
      </div>

      {/* Editor layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200/60 bg-slate-50/50 p-5 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
            <TitleGenerator title={draft?.title ?? ""} onTitleChange={handleTitle} disabled={isGenerating} hideAIActions />
            </div>
            <GenerationPanel article={draft} onArticleUpdate={handleUpdate} disabled={isGenerating} />
        </aside>

        <section className="min-w-0 bg-white p-5 lg:p-6 xl:p-8 overflow-y-auto custom-scrollbar shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <ArticleEditor article={draft} onChange={(article) => handleUpdate(article)} disabled={isGenerating} hideAIActions />
        </section>
      </div>

      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="放弃未保存的更改？"
        description="如果你现在离开，刚刚编辑的内容将会丢失。建议先点击「保存草稿」。"
        confirmLabel="强制离开"
        cancelLabel="继续编辑"
        variant="destructive"
        onConfirm={handleConfirmExit}
      />
      <ArticleAISettingsDialog open={showAISettings} onOpenChange={setShowAISettings} />
    </div>
  );
}
