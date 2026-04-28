import { useRef, useState } from "react";
import type { ReactNode } from "react";
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

function FeatureCard({
	icon,
	title,
	description,
	action,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
			<div className="mb-4 flex flex-col gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
						{icon}
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-base font-semibold text-slate-950">{title}</p>
						<p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
					</div>
				</div>
				{action ? <div className="flex justify-end">{action}</div> : null}
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
		<div className="mt-5 space-y-5">
			<FeatureCard
				icon={<Image className="h-4 w-4" />}
				title="封面图"
				description="支持粘贴链接，也可以点击预览区上传本地图片。"
				action={
					<Button
						variant="secondary"
						size="sm"
						disabled={coverUploadDisabled}
						type="button"
						className="w-full gap-2 rounded-full border border-slate-200 bg-white shadow-soft sm:w-auto"
						onClick={openCoverPicker}
					>
						{loading.uploadCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
						上传图片
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

				<Input
					type="text"
					disabled={disabled}
					value={article?.coverImage ?? ""}
					onChange={(event) => article && onArticleUpdate({ coverImage: event.target.value })}
					placeholder="https://example.com/cover.png"
					className="mb-4 h-11 rounded-2xl border-slate-200 bg-white px-4 text-sm shadow-inner-soft"
				/>

				<button
					type="button"
					disabled={coverUploadDisabled}
					onClick={openCoverPicker}
					className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-slate-100"
				>
					{article?.coverImage ? (
						<>
							<img src={article.coverImage} alt="封面预览" className="h-full w-full object-contain" />
							<div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
								点击更换封面
							</div>
						</>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
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
					<div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
						<CheckCircle2 className="h-3.5 w-3.5" />
						{uploadMessage}
					</div>
				)}

				{uploadError && (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						封面上传失败: {uploadError}
					</div>
				)}
			</FeatureCard>

			<FeatureCard
				icon={<AlignLeft className="h-4 w-4" />}
				title="文章摘要"
				description="用于列表摘要和部分平台的描述字段。"
				action={!hideAIActions ? (
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !article?.content?.trim() || loading.summary}
						onClick={handleGenerateSummary}
						type="button"
						className="w-full gap-2 rounded-full border-slate-200 bg-white shadow-soft sm:w-auto"
					>
						{loading.summary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
						AI 生成摘要
					</Button>
				) : null}
			>
				<Textarea
					disabled={disabled}
					value={article?.summary ?? ""}
					onChange={(event) => article && onArticleUpdate({ summary: event.target.value })}
					placeholder="输入文章摘要"
					className="min-h-36 resize-none rounded-2xl border-slate-200 bg-white p-4 leading-7 shadow-inner-soft"
				/>
			</FeatureCard>

			<FeatureCard
				icon={<Tags className="h-4 w-4" />}
				title="文章标签"
				description="可手动新增、删除、修改，也可用 AI 覆盖生成。"
				action={!hideAIActions ? (
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !article?.content?.trim() || loading.tags}
						onClick={handleGenerateTags}
						type="button"
						className="w-full gap-2 rounded-full border-slate-200 bg-white shadow-soft sm:w-auto"
					>
						{loading.tags ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
						AI 生成标签
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
