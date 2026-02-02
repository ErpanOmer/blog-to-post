import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Share2, Zap, Loader2, User, Home, Settings } from "lucide-react";
import { NotificationContainer } from "../components/NotificationSystem";
import { GlobalLoadingOverlay } from "../components/GlobalLoadingOverlay";

interface MainLayoutProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isPublishing: boolean;
    isGenerating: boolean;
    onOpenEditor: () => void;
    children: React.ReactNode;
}

export function MainLayout({
    activeTab,
    onTabChange,
    isPublishing,
    isGenerating,
    onOpenEditor,
    children,
}: MainLayoutProps) {
    return (
        <>
            <NotificationContainer />

            {/* Publishing Overlay */}
            {isPublishing && (
                <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                                <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">正在发布中</h3>
                            <p className="text-sm text-slate-500">请等待发布任务完成，期间无法操作其他功能</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-slate-200/30 text-slate-900">
                <GlobalLoadingOverlay isLoading={isGenerating} />

                {/* Header */}
                <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/25">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">AI 多平台技术文章分发系统</p>
                                <p className="text-xs text-slate-500">Cloudflare Workers + Hono + D1 / KV / R2</p>
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 mx-8">
                            <TabsList className="bg-slate-100/80 p-1">
                                <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <Home className="h-4 w-4" /> 首页
                                </TabsTrigger>
                                <TabsTrigger value="articles" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <FileText className="h-4 w-4" /> 文章列表
                                </TabsTrigger>
                                <TabsTrigger value="distribution" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <Share2 className="h-4 w-4" /> 分发状态
                                </TabsTrigger>
                                <TabsTrigger value="accounts" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <User className="h-4 w-4" /> 平台帐号
                                </TabsTrigger>
                                <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <Settings className="h-4 w-4" /> 平台设置
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-3">
                            <Button variant="gradient" size="sm" onClick={onOpenEditor} type="button" className="gap-2">
                                <Zap className="h-4 w-4" /> 生成文章
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
                    {children}
                </main>
            </div>
        </>
    );
}
