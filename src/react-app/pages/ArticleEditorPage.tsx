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
  isDirty: boolean;
  isDraftSaveable: boolean;
  isPublishReady: boolean;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onArticleUpdate: (updates: Partial<Article>) => void;
  onSave: () => Promise<Article | null> | void;
  onQuickPublish: () => void;
}

export function ArticleEditorPage({
  draft,
  isGenerating,
  isSaving,
  isDirty,
  isDraftSaveable,
  isPublishReady,
  onBack,
  onTitleChange,
  onArticleUpdate,
  onSave,
  onQuickPublish,
}: ArticleEditorPageProps) {
  const hasTitle = Boolean(draft?.title?.trim());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const editorDisabled = isGenerating || isSaving;

  // 保护机制：如果用户试图关闭页面或刷新，给出浏览器原生提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleBackClick = () => {
    if (isDirty) {
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
    <div className="flex h-full w-full flex-1 flex-col bg-design-background page-enter">
      {/* 沉浸式顶部栏 */}
      <div className="shrink-0 border-b border-design-border bg-white/85 px-4 py-2.5 backdrop-blur-xl md:px-5">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={handleBackClick} className="gap-1.5 text-design-textSecondary hover:bg-design-background hover:text-design-text">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">返回</span>
            </Button>

            <div className="h-4 w-px bg-design-border" />

            <div className="icon-tile flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold leading-tight text-design-text">文章编辑工作台</h1>
              <p className="text-[12px] text-design-neutral">
                {hasTitle ? "正在编辑并准备分发" : "请先输入一个好标题"}
                {isDirty && <span className="ml-2 text-amber-500 font-medium">* 有未保存的更改</span>}
                <span className="ml-2 text-emerald-500">实时备份已开启</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISettings(true)}
              disabled={editorDisabled}
              type="button"
              className="gap-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">AI 设置</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void onSave()}
              disabled={!isDraftSaveable || isSaving || isGenerating}
              title={!isDraftSaveable ? "请至少填写标题或正文" : "保存当前草稿"}
              type="button"
              className="gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">保存草稿</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onQuickPublish}
              disabled={!isPublishReady || isSaving || isGenerating}
              title={!isPublishReady ? "快速发布前需要补全标题、正文、摘要、标签和封面" : "快速发布"}
              type="button"
              className="gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" />
              快速发布
            </Button>
          </div>
        </div>
      </div>

      {/* Editor layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[clamp(380px,20vw,450px)_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-r border-design-border bg-design-background p-4 custom-scrollbar">
            <div className="space-y-3">
            <TitleGenerator title={draft?.title ?? ""} onTitleChange={onTitleChange} disabled={editorDisabled} hideAIActions />
            </div>
            <GenerationPanel article={draft} onArticleUpdate={onArticleUpdate} disabled={editorDisabled} />
        </aside>

        <section className="min-w-0 overflow-y-auto bg-white p-4 lg:p-5 xl:p-6 custom-scrollbar">
          <ArticleEditor article={draft} onChange={onArticleUpdate} disabled={editorDisabled} hideAIActions />
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
