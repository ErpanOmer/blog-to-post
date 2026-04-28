import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlignLeft, CheckCircle2, Image, Loader2, Tags, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function FeatureCard({
	icon,
	title,
	action,
	children,
}: {
	icon: ReactNode;
	title: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-card">
			<div className="mb-2.5 flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
						{icon}
					</div>
					<p className="min-w-0 truncate text-[15px] font-semibold text-slate-950">{title}</p>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</section>
	);
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
		<div className="mt-3 space-y-3">
			<FeatureCard
				icon={<Image className="h-4 w-4" />}
				title="封面图"
				action={
					<Button
						variant="secondary"
						size="sm"
						disabled={coverUploadDisabled}
						type="button"
						className="h-8 gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs shadow-soft"
						onClick={openCoverPicker}
					>
						{loading.uploadCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
						上传
					</Button>
				}
			>
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

				<button
					type="button"
					disabled={coverUploadDisabled}
					onClick={openCoverPicker}
					className="group relative block aspect-[21/9] w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-slate-100"
				>
					{article?.coverImage ? (
						<>
							<img src={article.coverImage} alt="封面预览" className="h-full w-full object-contain" />
							<div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
								点击更换封面
							</div>
						</>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-500">
							{loading.uploadCover ? (
								<Loader2 className="h-5 w-5 animate-spin text-brand-500" />
							) : (
								<Upload className="h-5 w-5 text-slate-400 transition-colors group-hover:text-brand-500" />
							)}
							<span>{loading.uploadCover ? "封面上传中..." : "点击上传本地图片"}</span>
						</div>
					)}
				</button>

				{uploadMessage && (
					<div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
						<CheckCircle2 className="h-3.5 w-3.5" />
						{uploadMessage}
					</div>
				)}

				{uploadError && (
					<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						封面上传失败: {uploadError}
					</div>
				)}
			</FeatureCard>

			<FeatureCard
				icon={<AlignLeft className="h-4 w-4" />}
				title="文章摘要"
				action={!hideAIActions ? (
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !article?.content?.trim() || loading.summary}
						onClick={handleGenerateSummary}
						type="button"
						className="h-8 gap-1.5 rounded-full border-slate-200 bg-white px-3 text-xs shadow-soft"
					>
						{loading.summary ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
						AI 生成
					</Button>
				) : null}
			>
				<Textarea
					disabled={disabled}
					value={article?.summary ?? ""}
					onChange={(event) => article && onArticleUpdate({ summary: event.target.value })}
					placeholder="输入文章摘要"
					className="min-h-[84px] resize-none rounded-xl border-slate-200 bg-white p-3 text-sm leading-6 shadow-inner-soft"
					rows={3}
				/>
			</FeatureCard>

			<FeatureCard
				icon={<Tags className="h-4 w-4" />}
				title="文章标签"
				action={!hideAIActions ? (
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !article?.content?.trim() || loading.tags}
						onClick={handleGenerateTags}
						type="button"
						className="h-8 gap-1.5 rounded-full border-slate-200 bg-white px-3 text-xs shadow-soft"
					>
						{loading.tags ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
						AI 生成
					</Button>
				) : null}
			>
				<EditableTagInput
					disabled={disabled}
					tags={article?.tags ?? []}
					onChange={(tags) => article && onArticleUpdate({ tags })}
					placeholder="例如：React、工程化、性能优化"
				/>
			</FeatureCard>
		</div>
	);
}
