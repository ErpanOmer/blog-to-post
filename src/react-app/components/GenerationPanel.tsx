import { useMemo, useState } from "react";
import type { Article } from "../types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArticleMetaForm } from "./ArticleMetaForm";
import { SectionCard } from "./SectionCard";
import { generateContent, generateCover, generateSummary, generateTags, generateTitle, getJuejinTopTitles } from "../api";

export function GenerationPanel({
	article,
	onArticleCreated,
	onArticleUpdate,
	onMessage,
}: {
	article: Article | null;
	onArticleCreated: (article: Article) => void;
	onArticleUpdate: (payload: Partial<Article>) => void;
	onMessage: (text: string) => void;
}) {
	const [titleSource, setTitleSource] = useState<"juejin" | "custom">("juejin");
	const [customTitles, setCustomTitles] = useState("");
	const [sourceTitles, setSourceTitles] = useState<string[]>([]);
	const [loading, setLoading] = useState({
		hot: false,
		title: false,
		content: false,
		summary: false,
		tags: false,
		cover: false,
	});

	const titlesPreview = useMemo(() => {
		const list = titleSource === "custom" ? customTitles.split("\n").map((item) => item.trim()).filter(Boolean) : sourceTitles;
		return list.slice(0, 20).join("\n");
	}, [customTitles, sourceTitles, titleSource]);

	const handleFetchHotTitles = async () => {
		setLoading((prev) => ({ ...prev, hot: true }));
		try {
			const titles = await getJuejinTopTitles();
			setSourceTitles(titles);
			onMessage(titles.length ? "已抓取掘金 Top20" : "未抓取到热门标题，建议手动填写");
		} catch (error) {
			console.error("获取热门标题失败", error);
			onMessage("获取热门标题失败，请稍后再试");
		} finally {
			setLoading((prev) => ({ ...prev, hot: false }));
		}
	};

	const handleGenerateTitle = async () => {
		const candidates = titleSource === "custom"
			? customTitles
				.split("\n")
				.map((item) => item.trim())
				.filter(Boolean)
			: sourceTitles;
		setLoading((prev) => ({ ...prev, title: true }));
		try {
			const { title } = await generateTitle({ titleSource, sourceTitles: candidates, platform: "juejin" });
			const now = Date.now();
			const tempId = crypto.randomUUID ? `temp-${crypto.randomUUID()}` : `temp-${now}`;
			onArticleCreated({
				id: tempId,
				title,
				content: "",
				summary: null,
				tags: null,
				coverImage: null,
				platform: "juejin",
				status: "draft",
				createdAt: now,
				updatedAt: now,
			});
			onMessage("标题已生成，请继续生成正文和元信息，最终保存才会落库。");
		} catch (error) {
			console.error("生成标题失败", error);
			onMessage("生成标题失败，请检查 AI Provider 配置");
		} finally {
			setLoading((prev) => ({ ...prev, title: false }));
		}
	};

	const handleGenerateContent = async () => {
		if (!article) return;
		setLoading((prev) => ({ ...prev, content: true }));
		try {
			let streamedContent = "";
			const { content } = await generateContent(article.title, (chunk) => {
				streamedContent += chunk;
				onArticleUpdate({ content: streamedContent });
			});
			onMessage("正文已生成并填充 ByteMD");
		} catch (error) {
			console.error("生成正文失败", error);
			onMessage("生成正文失败，请稍后再试");
		} finally {
			setLoading((prev) => ({ ...prev, content: false }));
		}
	};


	const handleGenerateSummary = async () => {
		if (!article) return;
		setLoading((prev) => ({ ...prev, summary: true }));
		try {
			const { summary } = await generateSummary(article.title, article.content);
			onArticleUpdate({ ...article, summary });
			onMessage("摘要已生成并覆盖");
		} catch (error) {
			console.error("生成摘要失败", error);
			onMessage("生成摘要失败");
		} finally {
			setLoading((prev) => ({ ...prev, summary: false }));
		}
	};

	const handleGenerateTags = async () => {
		if (!article) return;
		setLoading((prev) => ({ ...prev, tags: true }));
		try {
			const { tags } = await generateTags(article.title, article.content);
			onArticleUpdate({ ...article, tags });
			onMessage("标签已生成并覆盖");
		} catch (error) {
			console.error("生成标签失败", error);
			onMessage("生成标签失败");
		} finally {
			setLoading((prev) => ({ ...prev, tags: false }));
		}
	};

	const handleGenerateCover = async () => {
		if (!article) return;
		setLoading((prev) => ({ ...prev, cover: true }));
		try {
			const { coverImage } = await generateCover(article.title, article.content);
			onArticleUpdate({ ...article, coverImage });
			onMessage("封面已生成并覆盖");
		} catch (error) {
			console.error("生成封面失败", error);
			onMessage("生成封面失败");
		} finally {
			setLoading((prev) => ({ ...prev, cover: false }));
		}
	};


	return (
		<div className="space-y-6">
			<SectionCard title="标题生成" description="先生成标题 + 唯一文章 ID，后续流程基于此展开">
				<div className="space-y-4">
					<Tabs value={titleSource} onValueChange={(value) => setTitleSource(value as "juejin" | "custom")}>

						<TabsList>
							<TabsTrigger value="juejin">掘金 Top20</TabsTrigger>
							<TabsTrigger value="custom">自定义标题</TabsTrigger>
						</TabsList>
						<TabsContent value="juejin">
							<Textarea value={titlesPreview} onChange={(event) => setSourceTitles(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} placeholder="点击下方获取掘金热门，或手动贴入候选标题" className="h-36" />
							<div className="flex flex-wrap gap-3 pt-3">
								<Button variant="outline" size="sm" onClick={handleFetchHotTitles} disabled={loading.hot} type="button">抓取掘金 Top20</Button>
								<Button size="sm" onClick={handleGenerateTitle} disabled={loading.title} type="button">AI 生成标题</Button>

							</div>
						</TabsContent>
						<TabsContent value="custom">
							<Textarea value={customTitles} onChange={(event) => setCustomTitles(event.target.value)} placeholder="每行一个候选标题，AI 会参考这些生成最终标题" className="h-36" />
							<div className="flex flex-wrap gap-3 pt-3">
								<Button size="sm" onClick={handleGenerateTitle} disabled={loading.title} type="button">AI 生成标题</Button>

							</div>
						</TabsContent>
					</Tabs>
					<p className="text-[11px] text-slate-500">生成标题会立即创建文章 ID，为后续正文和元信息生成奠定基础。</p>
				</div>
			</SectionCard>

			<SectionCard title="正文与元信息" description="生成正文后，可 AI 补齐封面 / 摘要 / 标签">
				<div className="space-y-4">
					<div className="flex flex-wrap gap-3">
						<Button onClick={handleGenerateContent} disabled={!article || loading.content} type="button">AI 生成正文</Button>
						{!article && <p className="text-xs text-slate-400">先生成标题以创建文章。</p>}
					</div>
					<ArticleMetaForm

						article={article}
						onChange={onArticleUpdate}
						onGenerateSummary={handleGenerateSummary}
						onGenerateTags={handleGenerateTags}
						onGenerateCover={handleGenerateCover}
						loading={{ summary: loading.summary, tags: loading.tags, cover: loading.cover }}
					/>
				</div>
			</SectionCard>
		</div>
	);
}
