import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import type { Article, PlatformType, PromptTemplate } from "./types";
import { distributeArticle, getArticles, getPromptTemplates, getProviderStatus, transitionArticle, updateArticle, updatePromptTemplate, createArticle, deleteArticle } from "./api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "./components/SectionCard";
import { ArticleList } from "./components/ArticleList";
import { ArticleEditor } from "./components/ArticleEditor";
import { ArticleDetailDialog } from "./components/ArticleDetailDialog";
import { DistributionPanel } from "./components/DistributionPanel";
import { ProviderStatusPanel } from "./components/ProviderStatusPanel";
import { PromptTemplateManager } from "./components/PromptTemplateManager";
import { TitleGenerator } from "./components/TitleGenerator";
import { GenerationPanel } from "./components/GenerationPanel";
import { GlobalLoadingOverlay } from "./components/GlobalLoadingOverlay";
import { 
  Sparkles, 
  RefreshCw, 
  FileText, 
  Share2, 
  Cpu, 
  Settings2, 
  HelpCircle,
  Zap,
  LayoutGrid,
  Save,
  X,
  Loader2
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Article | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [providerStatus, setProviderStatus] = useState<{ provider: string; ready: boolean; lastCheckedAt: number; message: string } | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["juejin"]);
  const [message, setMessage] = useState("系统已就绪，点击生成文章开始创作。");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("articles");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
    getArticles().then(setArticles).catch((error) => console.error("加载文章失败", error));
    getProviderStatus().then(setProviderStatus).catch((error) => console.error("加载 Provider 失败", error));
    getPromptTemplates().then(setPromptTemplates).catch((error) => console.error("加载模板失败", error));
  }, []);

  useEffect(() => {
    setDraft(selectedArticle ?? null);
  }, [selectedArticle]);

  const refreshArticles = () => {
    getArticles().then(setArticles).catch((error) => console.error("刷新文章失败", error));
  };

  const handleOpenEditor = () => {
    // 创建新文章草稿
    const newArticle = createEmptyArticle();
    setDraft(newArticle);
    setIsEditorOpen(true);
    setMessage("请填写文章标题，然后生成正文和元信息。");
  };

  const handleCloseEditor = () => {
    if (isGenerating) return; // 生成中不能关闭
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
        setMessage("草稿已保存。");
        setIsEditorOpen(false);
        setDraft(null);
      })
      .catch((error) => {
        console.error("保存失败", error);
        setMessage("保存失败，请稍后再试。");
      })
      .finally(() => setIsLoading(false));
  };

  const handleTransition = (status: "reviewed" | "scheduled" | "published") => {
    if (!selectedArticle) return;
    transitionArticle(selectedArticle.id, status)
      .then((article) => {
        setArticles((prev) => prev.map((item) => (item.id === article.id ? article : item)));
        setMessage(`状态已更新为 ${status}。`);
      })
      .catch((error) => console.error("更新状态失败", error));
  };

  const handlePublish = () => {
    if (!selectedArticle) return;
    distributeArticle(selectedArticle.id, selectedPlatforms)
      .then((data) => {
        setArticles((prev) => prev.map((item) => (item.id === data.article.id ? data.article : item)));
        setMessage("已生成多平台发布内容，状态已进入 published。");
      })
      .catch((error) => console.error("发布失败", error));
  };

  const handleSchedule = () => {
    handleTransition("scheduled");
  };

  const handleViewDetail = (article: Article) => {
    setDetailArticle(article);
    setIsDetailOpen(true);
  };

  const handleEdit = (article: Article) => {
    // 只有草稿状态才能编辑
    if (article.status !== 'draft') {
      setMessage("只有草稿状态的文章才能编辑");
      return;
    }
    setDraft({ ...article });
    setIsEditorOpen(true);
  };

  const handleDelete = (article: Article) => {
    // 只有草稿状态才能删除
    if (article.status !== 'draft') {
      setMessage("只有草稿状态的文章才能删除");
      return;
    }
    if (!confirm(`确定要删除文章 "${article.title || '未命名文章'}" 吗？`)) {
      return;
    }
    deleteArticle(article.id)
      .then(() => {
        setArticles((prev) => prev.filter((item) => item.id !== article.id));
        setMessage("文章已删除");
      })
      .catch((error) => {
        console.error("删除失败", error);
        setMessage("删除失败，请稍后再试");
      });
  };

  const togglePlatform = (platform: PlatformType) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform],
    );
  };

  const handleSaveTemplate = (template: PromptTemplate) => {
    updatePromptTemplate(template.key, template.template)
      .then((result) => {
        setPromptTemplates((prev) => prev.map((item) => (item.key === result.key ? result : item)));
        setMessage(`${template.key} 模板已保存。`);
      })
      .catch((error) => console.error("保存模板失败", error));
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-slate-200/30 text-slate-900">
        {/* Global Loading Overlay */}
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
            <div className="flex items-center gap-3">
              <Button variant="gradient" size="sm" onClick={handleOpenEditor} type="button" className="gap-2">
                <Zap className="h-4 w-4" />
                生成文章
              </Button>
              <Button variant="secondary" size="sm" onClick={refreshArticles} type="button" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                刷新数据
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
          {/* System Message */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-6 py-4 shadow-soft backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">系统消息</p>
                <p className="text-xs text-slate-500">{message}</p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" type="button" className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  状态机说明
                </Button>
              </TooltipTrigger>
              <TooltipContent>全流程均在 Worker 托管。</TooltipContent>
            </Tooltip>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-screen-sm grid-cols-4 bg-white/80 p-1 shadow-soft backdrop-blur-sm">
              <TabsTrigger value="articles" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
                <FileText className="h-8 w-4" />
                文章列表
              </TabsTrigger>
              <TabsTrigger value="distribution" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
                <Share2 className="h-8 w-4" />
                分发状态
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
                <Cpu className="h-8 w-4" />
                AI Provider
              </TabsTrigger>
              <TabsTrigger value="prompts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
                <Settings2 className="h-8 w-4" />
                Prompt 模板
              </TabsTrigger>
            </TabsList>

            <TabsContent value="articles" className="animate-in">
              <SectionCard 
                title="文章清单" 
                description="仅展示文章列表与状态。"
                icon={<FileText className="h-5 w-5" />}
              >
                <ScrollArea className="h-[520px] pr-4">
                  <ArticleList 
                    articles={articles} 
                    onViewDetail={handleViewDetail}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </ScrollArea>
              </SectionCard>
            </TabsContent>

            <TabsContent value="distribution" className="animate-in">
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <SectionCard 
                  title="状态流转" 
                  description="手动发布 / 排期 / 失败回滚。"
                  icon={<Share2 className="h-5 w-5" />}
                >
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-4 text-sm text-slate-600 shadow-sm">
                      <span className="font-medium text-slate-900">当前文章：</span>
                      {selectedArticle?.title ?? "未选择"}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button size="sm" onClick={() => handleTransition("reviewed")} disabled={!selectedArticle} type="button">
                        送审
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleTransition("scheduled")} disabled={!selectedArticle} type="button">
                        排期
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTransition("published")} disabled={!selectedArticle} type="button">
                        标记发布
                      </Button>
                    </div>
                  </div>
                </SectionCard>
                <SectionCard 
                  title="分发队列" 
                  description="选择平台并生成可发布内容。"
                  icon={<Zap className="h-5 w-5" />}
                >
                  <DistributionPanel
                    article={selectedArticle}
                    selectedPlatforms={selectedPlatforms}
                    onToggle={togglePlatform}
                    onPublish={handlePublish}
                    onSchedule={handleSchedule}
                  />
                </SectionCard>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="animate-in">
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard 
                  title="Provider 状态" 
                  description="基于环境变量 AI_PROVIDER 自动切换。"
                  icon={<Cpu className="h-5 w-5" />}
                >
                  <ProviderStatusPanel status={providerStatus} />
                </SectionCard>
                <SectionCard 
                  title="运行参数" 
                  description="后端统一托管 AI 模型与 Prompt。"
                  icon={<Settings2 className="h-5 w-5" />}
                >
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="font-medium text-slate-700">AI_PROVIDER</span>
                      <span className="rounded-md bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">
                        {providerStatus?.provider ?? "ollama"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="font-medium text-slate-700">Ollama URL</span>
                      <span className="text-xs text-slate-500">在 Worker 变量中配置</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="font-medium text-slate-700">当前模式</span>
                      <span className="text-xs text-slate-500">仅使用本地 Ollama</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </TabsContent>

            <TabsContent value="prompts" className="animate-in">
              <SectionCard 
                title="Prompt 模板管理" 
                description="KV 中的模板可以独立更新。"
                icon={<Settings2 className="h-5 w-5" />}
              >
                <PromptTemplateManager templates={promptTemplates} onChange={setPromptTemplates} onSave={handleSaveTemplate} />
              </SectionCard>
            </TabsContent>
          </Tabs>
        </main>

        {/* Article Editor Dialog */}
        <Dialog 
          open={isEditorOpen} 
          onOpenChange={(open) => {
            if (!open && isGenerating) return; // 生成中不能关闭
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
                    variant="gradient" 
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
                    variant="outline" 
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
              {/* Left Column - Title & Meta */}
              <div className="absolute inset-y-0 left-0 w-[400px] overflow-y-auto border-r border-slate-200/60 bg-slate-50/50">
                <div className="space-y-4 p-4">
                  {/* Title Generator */}
                  <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                    <TitleGenerator
                      title={draft?.title ?? ""}
                      onTitleChange={handleTitleChange}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Meta Info Panel */}
                  <GenerationPanel
                    article={draft}
                    onArticleUpdate={handleArticleUpdate}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {/* Right Column - Content Editor */}
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
      </div>
    </TooltipProvider>
  );
}

export default App;
