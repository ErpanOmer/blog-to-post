import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, Rocket, X, Sparkles } from "lucide-react";
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
    isFormValid: boolean;
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
    isFormValid,
    onTitleChange,
    onArticleUpdate,
    onSave,
    onQuickPublish,
    onClose,
}: ArticleEditorSheetProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && isGenerating) return;
                onOpenChange(open);
            }}
        >
            <DialogContent
                className="flex flex-col h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-hidden border-slate-200/60 bg-white/95 backdrop-blur-xl p-0 gap-0"
                hideClose
                onPointerDownOutside={(e) => {
                    if (isGenerating) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (isGenerating) e.preventDefault();
                }}
            >
                {/* Header */}
                <DialogHeader className="flex-shrink-0 border-b border-slate-200/60 px-6 py-4 pr-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/25">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">文章编辑</DialogTitle>
                                <p className="text-sm text-slate-500">填写标题、生成正文、完善元信息后保存</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSave}
                                disabled={!isFormValid || isLoading || isGenerating}
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
                                disabled={!isFormValid || isLoading || isGenerating}
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
                    <div className="absolute inset-y-0 left-0 w-[400px] overflow-y-auto border-r border-slate-200/60 bg-slate-50/50">
                        <div className="space-y-4 p-4">
                            <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                                <TitleGenerator
                                    title={draft?.title ?? ""}
                                    onTitleChange={onTitleChange}
                                    disabled={isGenerating}
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
                                onChange={(article: Article) => onArticleUpdate(article)} // ArticleEditor expects (article) => void, but I can pass full object
                                disabled={isGenerating}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
