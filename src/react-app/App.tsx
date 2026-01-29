import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { Article, PlatformType, PromptTemplate } from "./types";
import { generateArticle, getArticles, getPromptTemplates, getProviderStatus, distributeArticle, transitionArticle, updateArticle, updatePromptTemplate } from "./api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "./components/SectionCard";
import { ArticleList } from "./components/ArticleList";
import { ArticleEditor } from "./components/ArticleEditor";
import { DistributionPanel } from "./components/DistributionPanel";
import { ProviderStatusPanel } from "./components/ProviderStatusPanel";
import { PromptTemplateManager } from "./components/PromptTemplateManager";
import { GenerateForm } from "./components/GenerateForm";

type GenerateFormState = {
	title: string;
	outline: string;
	platform: PlatformType;
	tone: "technical" | "casual" | "marketing";
	length: "short" | "medium" | "long";
};

const defaultForm: GenerateFormState = {
	title: "",
	outline: "",
	platform: "juejin",
	tone: "technical",
	length: "medium",
};

function App() {
	const [articles, setArticles] = useState<Article[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<Article | null>(null);
	const [form, setForm] = useState<GenerateFormState>(defaultForm);
	const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
	const [providerStatus, setProviderStatus] = useState<{ provider: string; ready: boolean; lastCheckedAt: number; message: string } | null>(null);
	const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["juejin"]);
	const [message, setMessage] = useState("系统已就绪，等待触发任务。");
	const [isLoading, setIsLoading] = useState(false);

	const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId]);

	useEffect(() => {
		getArticles().then(setArticles).catch((error) => console.error("加载文章失败", error));
		getProviderStatus().then(setProviderStatus).catch((error) => console.error("加载 Provider 失败", error));
		getPromptTemplates().then(setPromptTemplates).catch((error) => console.error("加载模板失败", error));
	}, []);

	useEffect(() => {
		setDraft(selectedArticle);
	}, [selectedArticle]);

	const refreshArticles = () => {
		getArticles().then(setArticles).catch((error) => console.error("刷新文章失败", error));
	};

	const handleGenerate = () => {
		setIsLoading(true);
		generateArticle({
			title: form.title,
			outline: form.outline || undefined,
			platform: form.platform,
			tone: form.tone,
			length: form.length,
		})
			.then((article) => {
				setArticles((prev) => [article, ...prev]);
				setSelectedId(article.id);
				setDraft(article);
				setMessage("草稿已生成并保存至 D1 + R2。可继续编辑或分发。");
				setForm(defaultForm);
			})
			.catch((error) => {
				console.error("生成失败", error);
				setMessage("生成失败，请检查 AI Provider 状态与绑定配置。");
			})
			.finally(() => setIsLoading(false));
	};

	const handleSave = () => {
		if (!draft) {
			return;
		}
		updateArticle(draft.id, {
			title: draft.title,
			content: draft.content,
			platform: draft.platform,
		})
			.then((article) => {
				setArticles((prev) => prev.map((item) => (item.id === article.id ? article : item)));
				setDraft(article);
				setMessage("草稿已保存。");
			})
			.catch((error) => console.error("保存失败", error));
	};

	const handleRegenerate = () => {
		if (!draft) {
			return;
		}
		setIsLoading(true);
		generateArticle({
			title: draft.title,
			platform: draft.platform,
			tone: "technical",
			length: "medium",
		})
			.then((article) => {
				setArticles((prev) => prev.map((item) => (item.id === draft.id ? article : item)));
				setDraft(article);
				setMessage("已生成新版本草稿。");
			})
			.catch((error) => console.error("重新生成失败", error))
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
							<Button variant="secondary" size="sm" onClick={refreshArticles} type="button">刷新数据</Button>
							<Dialog>
								<DialogTrigger asChild>
									<Button size="sm" type="button">流程示例</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>生成 → 适配 → 分发流程</DialogTitle>
										<DialogDescription>本文流程直接对应 Worker 内的任务与状态机。</DialogDescription>
									</DialogHeader>
									<div className="mt-4 space-y-2 text-sm text-slate-600">
										<p>1. 输入标题 + 大纲，触发 AI 生成草稿并写入 D1 / R2。</p>
										<p>2. 后端按平台适配内容，生成可发布版本。</p>
										<p>3. 状态机推进：draft → reviewed → scheduled → published。</p>
									</div>
								</DialogContent>
							</Dialog>
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
								<Button variant="outline" size="sm" type="button" onClick={() => setMessage("状态机遵循 draft → reviewed → scheduled → published → failed。")}>状态机说明</Button>
							</TooltipTrigger>
							<TooltipContent>状态流转在 Worker 侧强校验</TooltipContent>
						</Tooltip>
					</div>

					<Tabs defaultValue="articles">
						<TabsList>
							<TabsTrigger value="articles">文章列表</TabsTrigger>
							<TabsTrigger value="editor">文章编辑</TabsTrigger>
							<TabsTrigger value="distribution">分发状态</TabsTrigger>
							<TabsTrigger value="ai">AI Provider</TabsTrigger>
							<TabsTrigger value="prompts">Prompt 模板</TabsTrigger>
						</TabsList>

						<TabsContent value="articles">
							<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
								<SectionCard title="文章清单" description="D1 中的草稿与发布状态。">
									<ScrollArea className="h-[420px] pr-4">
										<ArticleList articles={articles} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
									</ScrollArea>
								</SectionCard>
								<SectionCard title="AI 生成" description="生成草稿并写入 R2 + D1。">
									<GenerateForm value={form} onChange={(next) => setForm(next)} onSubmit={handleGenerate} isLoading={isLoading} />
								</SectionCard>
							</div>
						</TabsContent>

						<TabsContent value="editor">
							<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
								<SectionCard title="文章清单" description="选择后进入编辑态。">
									<ScrollArea className="h-[420px] pr-4">
										<ArticleList articles={articles} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
									</ScrollArea>
								</SectionCard>
								<SectionCard title="编辑草稿" description="支持在线修改与 AI 重新生成。">
									<ArticleEditor article={draft} onChange={setDraft} onSave={handleSave} onRegenerate={handleRegenerate} />
								</SectionCard>
							</div>
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
										<p>AI_PROVIDER：{providerStatus?.provider ?? "未配置"}</p>
										<p>Ollama URL：在 Worker 变量中配置 OLLAMA_BASE_URL。</p>
										<p>Cloudflare AI：绑定 AI 并启用 @cloudflare/ai。</p>
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
			</div>
		</TooltipProvider>
	);
}

export default App;
