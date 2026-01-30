import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { Article, PlatformType, PromptTemplate } from "./types";
import { distributeArticle, getArticles, getPromptTemplates, getProviderStatus, transitionArticle, updateArticle, updatePromptTemplate, createArticle } from "./api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "./components/SectionCard";
import { ArticleList } from "./components/ArticleList";
import { ArticleEditor } from "./components/ArticleEditor";
import { DistributionPanel } from "./components/DistributionPanel";
import { ProviderStatusPanel } from "./components/ProviderStatusPanel";
import { PromptTemplateManager } from "./components/PromptTemplateManager";
import { GenerationPanel } from "./components/GenerationPanel.tsx";

function App() {
	const [articles, setArticles] = useState<Article[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<Article | null>(null);
	const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
	const [providerStatus, setProviderStatus] = useState<{ provider: string; ready: boolean; lastCheckedAt: number; message: string } | null>(null);
	const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["juejin"]);
	const [message, setMessage] = useState("系统已就绪，先生成标题。");
	const [isLoading, setIsLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("articles");
	const [isEditorOpen, setIsEditorOpen] = useState(false);

	const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId]);

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
		setIsEditorOpen(true);
	};

	const handleArticleCreated = (article: Article) => {
		setSelectedId(article.id);
		setDraft(article);
		setMessage("标题已生成，继续生成正文与元信息，最终保存才会创建草稿。");
	};

	const handleArticleUpdate = (updates: Partial<Article>) => {
		setDraft((prev) => {
			if (!prev) {
				return prev;
			}
			const merged = { ...prev, ...updates } as Article;
			setArticles((list) => list.map((item) => (item.id === merged.id ? merged : item)));
			return merged;
		});
	};

	const handleSave = () => {
		if (!draft) {
			return;
		}
		if (!draft.title || !draft.content || !draft.summary || !draft.tags?.length || !draft.coverImage) {
			setMessage("请先生成/填写 标题、正文、摘要、标签、封面，再保存。");
			return;
		}
		setIsLoading(true);
		const exists = articles.some((item) => item.id === draft.id);
		const action = exists
			? updateArticle(draft.id, {
				title: draft.title,
				content: draft.content,
				platform: draft.platform,
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
				setDraft(article);
				setMessage("草稿已保存。");
			})
			.catch((error) => {
				console.error("保存失败", error);
				setMessage("保存失败，请稍后再试。");
			})
			.finally(() => setIsLoading(false));
	};

	const handleTransition = (status: "reviewed" | "scheduled" | "published") => {
		if (!selectedArticle) {
			return;
		}
		transitionArticle(selectedArticle.id, status)
			.then((article) => {
				setArticles((prev) => prev.map((item) => (item.id === article.id ? article : item)));
				setDraft(article);
				setMessage(`状态已更新为 ${status}。`);
			})
			.catch((error) => console.error("更新状态失败", error));
	};

	const handlePublish = () => {
		if (!selectedArticle) {
			return;
		}
		distributeArticle(selectedArticle.id, selectedPlatforms)
			.then((data) => {
				setArticles((prev) => prev.map((item) => (item.id === data.article.id ? data.article : item)));
				setDraft(data.article);
				setMessage("已生成多平台发布内容，状态已进入 published。");
			})
			.catch((error) => console.error("发布失败", error));
	};

	const handleSchedule = () => {
		handleTransition("scheduled");
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
			<div className="min-h-screen bg-slate-50 text-slate-900">
				<header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
					<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
						<div>
							<p className="text-sm font-semibold text-slate-900">AI 多平台技术文章分发系统</p>
							<p className="text-xs text-slate-500">Cloudflare Workers + Hono + D1 / KV / R2</p>
						</div>
						<div className="flex items-center gap-3">
							<Button size="sm" onClick={handleOpenEditor} type="button">生成文章</Button>
							<Button variant="secondary" size="sm" onClick={refreshArticles} type="button">刷新数据</Button>
						</div>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-6 pb-16 pt-24">
					<div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
						<div>
							<p className="text-sm font-semibold text-slate-900">系统消息</p>
							<p className="text-xs text-slate-500">{message}</p>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" type="button" onClick={() => setMessage("流程：先生成标题 → 生成正文 → AI 补齐封面/摘要/标签。")}>状态机说明</Button>
							</TooltipTrigger>
							<TooltipContent>全流程均在 Worker 托管。</TooltipContent>
						</Tooltip>
					</div>

					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList>
							<TabsTrigger value="articles">文章列表</TabsTrigger>
							<TabsTrigger value="distribution">分发状态</TabsTrigger>
							<TabsTrigger value="ai">AI Provider</TabsTrigger>
							<TabsTrigger value="prompts">Prompt 模板</TabsTrigger>
						</TabsList>

						<TabsContent value="articles">
							<SectionCard title="文章清单" description="仅展示文章列表与状态。">
								<ScrollArea className="h-[520px] pr-4">
									<ArticleList articles={articles} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
								</ScrollArea>
							</SectionCard>
						</TabsContent>

						<TabsContent value="distribution">
							<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
								<SectionCard title="状态流转" description="手动发布 / 排期 / 失败回滚。">
									<div className="space-y-4">
										<div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
											当前文章：{selectedArticle?.title ?? "未选择"}
										</div>
										<div className="flex flex-wrap gap-3">
											<Button size="sm" onClick={() => handleTransition("reviewed")} disabled={!selectedArticle} type="button">送审</Button>
											<Button size="sm" variant="secondary" onClick={() => handleTransition("scheduled")} disabled={!selectedArticle} type="button">排期</Button>
											<Button size="sm" variant="outline" onClick={() => handleTransition("published")} disabled={!selectedArticle} type="button">标记发布</Button>
										</div>
									</div>
								</SectionCard>
								<SectionCard title="分发队列" description="选择平台并生成可发布内容。">
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

						<TabsContent value="ai">
							<div className="grid gap-6 lg:grid-cols-2">
								<SectionCard title="Provider 状态" description="基于环境变量 AI_PROVIDER 自动切换。">
									<ProviderStatusPanel status={providerStatus} />
								</SectionCard>
								<SectionCard title="运行参数" description="后端统一托管 AI 模型与 Prompt。">
									<div className="space-y-3 text-sm text-slate-600">
										<p>AI_PROVIDER：{providerStatus?.provider ?? "ollama"}</p>
										<p>Ollama URL：在 Worker 变量中配置 OLLAMA_BASE_URL。</p>
										<p>当前模式：仅使用本地 Ollama。</p>
									</div>
								</SectionCard>
							</div>
						</TabsContent>

						<TabsContent value="prompts">
							<SectionCard title="Prompt 模板管理" description="KV 中的模板可以独立更新。">
								<PromptTemplateManager templates={promptTemplates} onChange={setPromptTemplates} onSave={handleSaveTemplate} />
							</SectionCard>
						</TabsContent>
					</Tabs>
				</main>

				<Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
					<DialogContent className="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-hidden">
						<div className="flex items-start justify-between gap-6">
							<DialogHeader className="space-y-2">
								<DialogTitle>文章编辑</DialogTitle>
								<DialogDescription>全屏编辑 Markdown，先生成标题，再一键生成正文，左侧补齐封面/摘要/标签。</DialogDescription>
							</DialogHeader>
							<div className="flex items-center gap-3">
								<Button variant="outline" size="sm" onClick={() => setIsEditorOpen(false)} type="button">关闭</Button>
								<Button size="sm" onClick={handleSave} disabled={!draft || isLoading} type="button">保存草稿</Button>
							</div>
						</div>
						<div className="grid h-[calc(100vh-8rem)] gap-6 overflow-hidden lg:grid-cols-[380px_1fr]">
							<div className="space-y-6 overflow-auto pr-2">
								<GenerationPanel article={draft} onArticleCreated={handleArticleCreated} onArticleUpdate={handleArticleUpdate} onMessage={setMessage} />
							</div>
							<div className="h-full overflow-auto">
								<SectionCard title="内容编辑" description="ByteMD 编辑器，生成内容自动填充。">
									<ArticleEditor article={draft} onChange={handleArticleUpdate} />
								</SectionCard>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	);
}

export default App;
