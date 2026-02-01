import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import type { Article } from "./types";
import { getArticles, getProviderStatus, updateArticle, createArticle, deleteArticle, createPublishTask } from "./api";
import { PublishDialog } from "./components/PublishDialog";
import { Dashboard } from "./components/Dashboard";
import { PlatformSettings } from "./components/PlatformSettings";
import { DistributionStatus } from "./components/DistributionStatus";
import { NotificationContainer, notify } from "./components/NotificationSystem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "./components/SectionCard";
import { ArticleList } from "./components/ArticleList";
import { ArticleEditor } from "./components/ArticleEditor";
import { ArticleDetailDialog } from "./components/ArticleDetailDialog";
import { TitleGenerator } from "./components/TitleGenerator";
import { GenerationPanel } from "./components/GenerationPanel";
import { GlobalLoadingOverlay } from "./components/GlobalLoadingOverlay";
import { PlatformAccountsPanel } from "./components/PlatformAccountsPanel";
import type { AccountConfig } from "./types/publications";
import { 
  Sparkles, 
  FileText, 
  Share2, 
  Zap,
  Save,
  X,
  Loader2,
  User,
  Home,
  Rocket,
  Settings
} from "lucide-react";

// 创建一个新的文章对象
function createEmptyArticle(): Article {
  const now = Date.now();
  
  // 开发环境默认填充内容
  if (import.meta.env.DEV) {
    return {
      id: `temp-${now}`,
      title: "探索优雅生活美学",
      content: `## 引言

在这个快节奏的时代，我们常常忽略了生活中的美学细节。本文将带您探索如何在家居空间中融入优雅的美学理念。

## 空间布局的重要性

一个精心设计的空间布局能够显著提升居住体验。关键在于：

1. **动线设计**：合理规划人的活动路线
2. **光线运用**：自然光与人工照明的完美结合
3. **色彩搭配**：和谐的色彩搭配营造舒适氛围

## 材质选择

选择合适的材质是打造高品质空间的关键：

- **天然材质**：原木、大理石、亚麻布
- **金属元素**：黄铜、拉丝不锈钢
- **织物软装**：丝绸、羊毛、棉麻

## 结语

通过这些设计理念，我们可以创造出既美观又实用的生活空间，让每一天都充满仪式感。`,
      summary: "本文探讨了如何在家居设计中融入优雅的生活美学，从空间布局、材质选择到色彩搭配，为追求品质生活的读者提供了实用的设计指南。",
      tags: ["生活方式", "家居设计", "美学", "室内设计"],
      coverImage: "https://newurtopia.com/cdn/shop/articles/Mask_Group_18.jpg?v=1754671914&width=500",
      platform: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
  }
  
  return {
    id: `temp-${now}`,
    title: "",
    content: "",
    summary: "",
    tags: [],
    coverImage: "",
    platform: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Article | null>(null);
  const [providerStatus, setProviderStatus] = useState<{ provider: string; ready: boolean; lastCheckedAt: number; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [articlesToPublish, setArticlesToPublish] = useState<Article[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId]);

  // 检查表单是否完整
  const isFormValid = useMemo(() => {
    if (!draft) return false;
    return (
      draft.title.trim().length > 0 &&
      draft.content.trim().length > 0 &&
      (draft.summary?.trim().length ?? 0) > 0 &&
      (draft.tags?.length ?? 0) > 0 &&
      (draft.coverImage?.trim().length ?? 0) > 0
    );
  }, [draft]);

  // 监听内容生成事件
  useEffect(() => {
    const handleContentGenerating = (e: CustomEvent<{ generating: boolean }>) => {
      setIsGenerating(e.detail.generating);
    };
    window.addEventListener('content-generating', handleContentGenerating as EventListener);
    return () => {
      window.removeEventListener('content-generating', handleContentGenerating as EventListener);
    };
  }, []);

  useEffect(() => {
    getArticles().then(setArticles).catch((error: Error) => {
      console.error("加载文章失败", error);
      notify.error("加载文章失败", error.message);
    });
    getProviderStatus().then(setProviderStatus).catch((error: Error) => {
      console.error("加载 Provider 失败", error);
    });
  }, []);

  // 当选择的文章变化时更新草稿
  useEffect(() => {
    if (selectedArticle) {
      setDraft(selectedArticle);
    }
  }, [selectedArticle]);

  const handleOpenEditor = () => {
    const newArticle = createEmptyArticle();
    setDraft(newArticle);
    setIsEditorOpen(true);
    notify.info("请填写文章标题，然后生成正文和元信息。");
  };

  const handleCloseEditor = () => {
    if (isGenerating) return;
    setIsEditorOpen(false);
    setDraft(null);
  };

  const handleTitleChange = useCallback((title: string) => {
    setDraft((prev) => prev ? { ...prev, title } : prev);
  }, []);

  const handleArticleUpdate = useCallback((updates: Partial<Article>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates } as Article;
    });
  }, []);

  const handleSave = () => {
    if (!draft || !isFormValid) return;
    
    setIsLoading(true);
    const exists = articles.some((item) => item.id === draft.id);
    const action = exists
      ? updateArticle(draft.id, {
        title: draft.title,
        content: draft.content,
        summary: draft.summary,
        tags: draft.tags,
        coverImage: draft.coverImage,
      })
      : createArticle({ ...draft, status: "draft" });

    action
      .then((article) => {
        setArticles((prev) => {
          return exists ? prev.map((item) => (item.id === article.id ? article : item)) : [article, ...prev];
        });
        notify.success("草稿已保存");
        setIsEditorOpen(false);
        setDraft(null);
      })
      .catch((error: Error) => {
        console.error("保存失败", error);
        notify.error("保存失败", error.message);
      })
      .finally(() => setIsLoading(false));
  };

  // BUG FIX: 快速发布 - 先打开发布弹窗，等发布成功后再保存草稿
  const handleQuickPublish = async () => {
    if (!draft || !isFormValid) return;
    
    // 先打开发布弹窗，让用户选择发布配置
    setArticlesToPublish([draft]);
    setIsPublishDialogOpen(true);
    // 注意：此时不保存草稿到数据库，等发布任务创建成功后再保存
  };

  // 处理快速发布的实际发布逻辑
  const handleQuickPublishConfirm = async (accountConfigs: AccountConfig[], scheduleTime: number | null) => {
    if (!draft) return;
    
    setIsPublishing(true);
    const loadingId = notify.loading("正在创建发布任务...");
    
    try {
      // 1. 先创建发布任务
      const result = await createPublishTask({
        articleIds: [draft.id], // 临时ID，实际发布时需要先保存
        accountConfigs,
        scheduleTime,
      });
      
      // 2. 发布任务创建成功后，才保存草稿到数据库
      const exists = articles.some((item) => item.id === draft.id);
      const savedArticle = exists
        ? await updateArticle(draft.id, {
            title: draft.title,
            content: draft.content,
            summary: draft.summary,
            tags: draft.tags,
            coverImage: draft.coverImage,
          })
        : await createArticle({ ...draft, status: "draft" });
      
      // 3. 更新文章列表
      setArticles((prev) => {
        return exists 
          ? prev.map((item) => (item.id === savedArticle.id ? savedArticle : item)) 
          : [savedArticle, ...prev];
      });
      
      // 4. 关闭编辑器
      setIsEditorOpen(false);
      setDraft(null);
      
      notify.remove(loadingId);
      notify.success("发布任务已创建", result.message, { showSystemNotification: true });
      
      // 5. 延迟关闭发布弹窗
      setTimeout(() => {
        setIsPublishDialogOpen(false);
        setIsPublishing(false);
      }, 1500);
      
    } catch (error) {
      notify.remove(loadingId);
      console.error("快速发布失败", error);
      notify.error("快速发布失败", error instanceof Error ? error.message : "请稍后再试");
      setIsPublishing(false);
    }
  };

  const handleViewDetail = (article: Article) => {
    setDetailArticle(article);
    setIsDetailOpen(true);
  };

  const handleEdit = (article: Article) => {
    if (article.status !== 'draft') {
      notify.error("只有草稿状态的文章才能编辑");
      return;
    }
    setDraft({ ...article });
    setIsEditorOpen(true);
  };

  const handleDelete = (article: Article) => {
    if (article.status !== 'draft') {
      notify.error("只有草稿状态的文章才能删除");
      return;
    }
    if (!confirm(`确定要删除文章 "${article.title || '未命名文章'}" 吗？`)) {
      return;
    }
    deleteArticle(article.id)
      .then(() => {
        setArticles((prev) => prev.filter((item) => item.id !== article.id));
        notify.success("文章已删除");
      })
      .catch((error: Error) => {
        console.error("删除失败", error);
        notify.error("删除失败", error.message);
      });
  };

  // BUG FIX: 点击发布按钮时只打开发布弹窗，不显示正在发布中遮罩层
  const handlePublish = (articles: Article[]) => {
    setArticlesToPublish(articles);
    setIsPublishDialogOpen(true);
    // 注意：这里不设置 setIsPublishing(true)，遮罩层应该在点击发布按钮后才显示
  };

  // 处理文章列表的发布确认
  const handlePublishConfirm = async (accountConfigs: AccountConfig[], scheduleTime: number | null) => {
    setIsPublishing(true);
    const loadingId = notify.loading("正在创建发布任务...");
    
    try {
      const result = await createPublishTask({
        articleIds: articlesToPublish.map(a => a.id),
        accountConfigs,
        scheduleTime,
      });
      
      notify.remove(loadingId);
      notify.success("发布任务已创建", result.message, { showSystemNotification: true });
      
      // 刷新文章列表
      getArticles().then(setArticles).catch(console.error);
      
      // 延迟关闭弹窗
      setTimeout(() => {
        setIsPublishDialogOpen(false);
        setIsPublishing(false);
      }, 1500);
      
    } catch (error) {
      notify.remove(loadingId);
      console.error("发布失败", error);
      notify.error("发布失败", error instanceof Error ? error.message : "请稍后再试");
      setIsPublishing(false);
    }
  };

  // Dashboard 快速入口处理函数
  const handleDashboardNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <>
      {/* Notification Container */}
      <NotificationContainer />
      
      {/* Publishing Overlay - 发布时禁用整个页面 - BUG FIX: 只在真正发布时显示 */}
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
        {/* Global Loading Overlay */}
        <GlobalLoadingOverlay isLoading={isGenerating} />

        {/* Header */}
        <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">AI 多平台技术文章分发系统</p>
                <p className="text-xs text-slate-500">Cloudflare Workers + Hono + D1 / KV / R2</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 mx-8">
              <TabsList className="bg-slate-100/80 p-1">
                <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Home className="h-4 w-4" />
                  首页
                </TabsTrigger>
                <TabsTrigger value="articles" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <FileText className="h-4 w-4" />
                  文章列表
                </TabsTrigger>
                <TabsTrigger value="distribution" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Share2 className="h-4 w-4" />
                  分发状态
                </TabsTrigger>
                <TabsTrigger value="accounts" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <User className="h-4 w-4" />
                  平台帐号
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Settings className="h-4 w-4" />
                  平台设置
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <Button variant="gradient" size="sm" onClick={handleOpenEditor} type="button" className="gap-2">
                <Zap className="h-4 w-4" />
                生成文章
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
          {/* Tab Contents */}
          <Tabs value={activeTab} className="space-y-6">
            {/* Dashboard */}
            <TabsContent value="dashboard" className="animate-in">
              <Dashboard 
                articles={articles} 
                onNavigate={handleDashboardNavigate}
              />
            </TabsContent>

            {/* Articles */}
            <TabsContent value="articles" className="animate-in">
              <SectionCard 
                title="文章清单" 
                description="管理所有文章，支持批量操作和发布。"
                icon={<FileText className="h-5 w-5" />}
              >
                <ScrollArea className="h-[600px] pr-4">
                  <ArticleList
                    articles={articles}
                    onViewDetail={handleViewDetail}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPublish={handlePublish}
                  />
                </ScrollArea>
              </SectionCard>
            </TabsContent>

            {/* Distribution Status */}
            <TabsContent value="distribution" className="animate-in">
              <DistributionStatus />
            </TabsContent>

            {/* Accounts */}
            <TabsContent value="accounts" className="animate-in">
              <SectionCard 
                title="平台帐号管理" 
                description="管理多平台发布所需的认证信息。"
                icon={<User className="h-5 w-5" />}
              >
                <PlatformAccountsPanel />
              </SectionCard>
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="animate-in">
              <PlatformSettings providerStatus={providerStatus} />
            </TabsContent>
          </Tabs>
        </main>

        {/* Article Editor Dialog */}
        <Dialog 
          open={isEditorOpen} 
          onOpenChange={(open) => {
            if (!open && isGenerating) return;
            setIsEditorOpen(open);
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
            {/* Dialog Header */}
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
                    onClick={handleSave} 
                    disabled={!isFormValid || isLoading || isGenerating}
                    type="button" 
                    className="gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    保存草稿
                  </Button>
                  
                  <Button 
                    variant="gradient" 
                    size="sm" 
                    onClick={handleQuickPublish}
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
                    onClick={handleCloseEditor} 
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

            {/* Dialog Body - Two Column Layout */}
            <div className="relative flex flex-1 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[400px] overflow-y-auto border-r border-slate-200/60 bg-slate-50/50">
                <div className="space-y-4 p-4">
                  <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                    <TitleGenerator
                      title={draft?.title ?? ""}
                      onTitleChange={handleTitleChange}
                      disabled={isGenerating}
                    />
                  </div>

                  <GenerationPanel
                    article={draft}
                    onArticleUpdate={handleArticleUpdate}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="ml-[400px] flex flex-1 flex-col overflow-hidden bg-white">
                <div className="flex-1 overflow-hidden p-4">
                  <ArticleEditor
                    article={draft}
                    onChange={handleArticleUpdate}
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Article Detail Dialog */}
        <ArticleDetailDialog
          article={detailArticle}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
        />

        {/* Publish Dialog - BUG FIX: 使用新的发布确认回调 */}
        {isPublishDialogOpen && (
          <PublishDialog
            articles={articlesToPublish}
            open={isPublishDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsPublishDialogOpen(false);
                // 如果取消发布，重置发布状态
                if (isPublishing) {
                  setIsPublishing(false);
                }
              }
            }}
            onPublishConfirm={handlePublishConfirm}
            onQuickPublishConfirm={draft ? handleQuickPublishConfirm : undefined}
            isQuickPublish={!!draft}
          />
        )}
      </div>
    </>
  );
}

export default App;
