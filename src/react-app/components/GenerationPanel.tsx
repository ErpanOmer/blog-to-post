import { useRef, useState } from "react";
import {
	AlignLeft,
	CheckCircle2,
	Image,
	Loader2,
	Tags,
	Upload,
	Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagInput } from "@/react-app/components/EditableTagInput";
import { generateArticleSummary, generateArticleTags } from "@/react-app/api";
import {
	getLocalArticleAIFeatureSettings,
	toArticleAIRequestSettings,
} from "@/react-app/services/article-ai-settings";
import { uploadImageToImageHosting } from "@/react-app/services/image-hosting";
import type { Article } from "@/react-app/types";

interface GenerationPanelProps {
	article: Article | null;
	onArticleUpdate: (payload: Partial<Article>) => void;
	disabled?: boolean;
	hideAIActions?: boolean;
}

export function GenerationPanel({
	article,
	onArticleUpdate,
	disabled,
	hideAIActions = false,
}: GenerationPanelProps) {
	const [loading, setLoading] = useState({
		summary: false,
		tags: false,
		uploadCover: false,
	});
	const [uploadMessage, setUploadMessage] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const coverFileInputRef = useRef<HTMLInputElement | null>(null);
	const coverUploadDisabled = disabled || loading.uploadCover || !article;

	const openCoverPicker = () => {
		if (coverUploadDisabled) return;
		coverFileInputRef.current?.click();
	};

	const handleGenerateSummary = async () => {
		if (!article?.content?.trim()) return;
		setLoading((prev) => ({ ...prev, summary: true }));

		try {
			const featureSettings = getLocalArticleAIFeatureSettings("summary");
			const requestSettings = toArticleAIRequestSettings("summary", featureSettings);
			const data = await generateArticleSummary(article.content, requestSettings);
			onArticleUpdate({ summary: data.summary });
		} catch (error) {
			console.error("Generate summary failed", error);
		} finally {
			setLoading((prev) => ({ ...prev, summary: false }));
		}
	};

	const handleGenerateTags = async () => {
		if (!article?.content?.trim()) return;
		setLoading((prev) => ({ ...prev, tags: true }));

		try {
			const featureSettings = getLocalArticleAIFeatureSettings("tags");
			const requestSettings = toArticleAIRequestSettings("tags", featureSettings);
			const data = await generateArticleTags(article.content, requestSettings);
			const normalizedTags = Array.isArray(data.tags)
				? data.tags.map((item) => String(item).trim()).filter(Boolean)
				: [];
			onArticleUpdate({ tags: normalizedTags });
		} catch (error) {
			console.error("Generate tags failed", error);
		} finally {
			setLoading((prev) => ({ ...prev, tags: false }));
		}
	};

	const handleUploadLocalCover = async (file: File | null) => {
		if (!file || !article) return;

		setUploadError(null);
		setUploadMessage(null);
		setLoading((prev) => ({ ...prev, uploadCover: true }));

		try {
			const url = await uploadImageToImageHosting(file);
			onArticleUpdate({ coverImage: url });
			setUploadMessage("封面已上传，并自动填入图片地址");
		} catch (error) {
			const message = error instanceof Error ? error.message : "封面上传失败";
			setUploadError(message);
			console.error("Upload cover failed", error);
		} finally {
			setLoading((prev) => ({ ...prev, uploadCover: false }));
			if (coverFileInputRef.current) {
				coverFileInputRef.current.value = "";
			}
		}
	};

	return (
		<div className="space-y-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
							<Image className="h-4 w-4" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-900">封面图</p>
							<p className="text-xs text-slate-500">支持粘贴链接，也可以点击预览区上传本地图片。</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={coverUploadDisabled}
							type="button"
							className="gap-2"
							onClick={openCoverPicker}
						>
							{loading.uploadCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
							上传图片
						</Button>

						<input
							ref={coverFileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0] ?? null;
								void handleUploadLocalCover(file);
							}}
						/>
					</div>
				</div>

				<Input
					type="text"
					disabled={disabled}
					value={article?.coverImage ?? ""}
					onChange={(event) => article && onArticleUpdate({ coverImage: event.target.value })}
					placeholder="https://example.com/cover.png"
					className="mb-3"
				/>

				<button
					type="button"
					disabled={coverUploadDisabled}
					onClick={openCoverPicker}
					className="group relative h-28 w-full overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-slate-50"
				>
					{article?.coverImage ? (
						<>
							<img src={article.coverImage} alt="封面预览" className="h-full w-full object-cover" />
							<div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
								点击更换封面
							</div>
						</>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
							{loading.uploadCover ? (
								<Loader2 className="h-5 w-5 animate-spin text-brand-500" />
							) : (
								<Upload className="h-5 w-5 text-slate-400 transition-colors group-hover:text-brand-500" />
							)}
							<span>{loading.uploadCover ? "封面上传中..." : "点击上传本地图片，封面预览会显示在这里"}</span>
						</div>
					)}
				</button>

				{uploadMessage && (
					<div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
						<CheckCircle2 className="h-3.5 w-3.5" />
						{uploadMessage}
					</div>
				)}

				{uploadError && (
					<div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						封面上传失败: {uploadError}
					</div>
				)}
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
							<AlignLeft className="h-4 w-4" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-900">文章摘要</p>
							<p className="text-xs text-slate-500">用于列表摘要和部分平台的描述字段。</p>
						</div>
					</div>

					{!hideAIActions && (
						<Button
							variant="outline"
							size="sm"
							disabled={disabled || !article?.content?.trim() || loading.summary}
							onClick={handleGenerateSummary}
							type="button"
							className="gap-2"
						>
							{loading.summary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
							AI 生成摘要
						</Button>
					)}
				</div>

				<Textarea
					disabled={disabled}
					value={article?.summary ?? ""}
					onChange={(event) => article && onArticleUpdate({ summary: event.target.value })}
					placeholder="输入文章摘要"
					className="min-h-32 resize-none"
				/>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
							<Tags className="h-4 w-4" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-900">文章标签</p>
							<p className="text-xs text-slate-500">可手动新增、删除、修改，也可用 AI 覆盖生成。</p>
						</div>
					</div>

					{!hideAIActions && (
						<Button
							variant="outline"
							size="sm"
							disabled={disabled || !article?.content?.trim() || loading.tags}
							onClick={handleGenerateTags}
							type="button"
							className="gap-2"
						>
							{loading.tags ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
							AI 生成标签
						</Button>
					)}
				</div>

				<EditableTagInput
					disabled={disabled}
					tags={article?.tags ?? []}
					onChange={(tags) => article && onArticleUpdate({ tags })}
					placeholder="例如：React、工程化、性能优化"
				/>
			</section>
		</div>
	);
}
