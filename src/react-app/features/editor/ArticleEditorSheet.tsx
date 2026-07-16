import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, Rocket, Settings2, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { ArticleAISettingsDialog } from "@/react-app/components/ArticleAISettingsDialog";
import { ArticleEditor } from "@/react-app/components/ArticleEditor";
import { TitleGenerator } from "@/react-app/components/TitleGenerator";
import { GenerationPanel } from "@/react-app/components/GenerationPanel";
import type { Article } from "@/react-app/types";

interface ArticleEditorSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    draft: Article | null;
    isGenerating: boolean;
    isLoading: boolean;
    isDraftSaveable: boolean;
    isPublishReady: boolean;
    onTitleChange: (title: string) => void;
    onArticleUpdate: (updates: Partial<Article>) => void;
    onSave: () => void;
    onQuickPublish: () => void;
    onClose: () => void;
}

export function ArticleEditorSheet({
    isOpen,
    onOpenChange,
    draft,
    isGenerating,
    isLoading,
    isDraftSaveable,
    isPublishReady,
    onTitleChange,
    onArticleUpdate,
    onSave,
    onQuickPublish,
    onClose,
}: ArticleEditorSheetProps) {
    const [showAISettings, setShowAISettings] = useState(false);

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open && isGenerating) return;
                    onOpenChange(open);
                }}
            >
                <DialogContent
                    className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden border-design-border bg-white/95 p-0 backdrop-blur-xl"
                    hideClose
                    onPointerDownOutside={(e) => {
                        if (isGenerating) e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (isGenerating) e.preventDefault();
                    }}
                >
                {/* Header */}
                <DialogHeader className="flex-shrink-0 border-b border-design-border px-6 py-4 pr-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-white">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="font-display text-xl font-semibold text-design-text">文章编辑</DialogTitle>
                                <p className="text-[13px] text-design-textSecondary">填写标题、生成正文、完善元信息后保存</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAISettings(true)}
                                disabled={isGenerating}
                                type="button"
                                className="gap-2"
                            >
                                <Settings2 className="h-4 w-4" />
                                AI 设置
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSave}
                                disabled={!isDraftSaveable || isLoading || isGenerating}
                                type="button"
                                className="gap-2"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                保存草稿
                            </Button>

                            <Button
                                variant="gradient"
                                size="sm"
                                onClick={onQuickPublish}
                                disabled={!isPublishReady || isLoading || isGenerating}
                                type="button"
                                className="gap-2"
                            >
                                <Rocket className="h-4 w-4" />
                                快速发布
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                disabled={isGenerating}
                                type="button"
                                className="gap-2"
                            >
                                <X className="h-4 w-4" />
                                关闭
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="relative flex flex-1 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[400px] overflow-y-auto border-r border-design-border bg-design-background">
                        <div className="space-y-4 p-4">
                            <div className="rounded-xl border border-design-border bg-white p-4">
                                <TitleGenerator
                                    title={draft?.title ?? ""}
                                    onTitleChange={onTitleChange}
                                    disabled={isGenerating}
                                    hideAIActions
                                />
                            </div>

                            <GenerationPanel
                                article={draft}
                                onArticleUpdate={onArticleUpdate}
                                disabled={isGenerating}
                            />
                        </div>
                    </div>

                    <div className="ml-[400px] flex flex-1 flex-col overflow-hidden bg-white">
                        <div className="flex-1 overflow-hidden p-4">
                            <ArticleEditor
                                article={draft}
                                onChange={onArticleUpdate}
                                disabled={isGenerating}
                                hideAIActions
                            />
                        </div>
                    </div>
                </div>
                </DialogContent>
            </Dialog>
            <ArticleAISettingsDialog open={showAISettings} onOpenChange={setShowAISettings} />
        </>
    );
}
