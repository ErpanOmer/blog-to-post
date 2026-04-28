import type { Article } from "@/react-app/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagInput } from "@/react-app/components/EditableTagInput";

export function ArticleMetaForm({
	article,
	onChange,
	onGenerateSummary,
	onGenerateTags,
	onGenerateCover,
	loading,
}: {
	article: Article | null;
	onChange: (payload: Partial<Article>) => void;
	onGenerateSummary: () => void;
	onGenerateTags: () => void;
	onGenerateCover: () => void;
	loading: { summary: boolean; tags: boolean; cover: boolean };
}) {
	const disabled = !article;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-semibold text-slate-500">封面图</label>
					<Button variant="outline" size="sm" disabled={disabled || loading.cover} onClick={onGenerateCover} type="button">
						AI 生成封面
					</Button>
				</div>
				<Input
					disabled={disabled}
					value={article?.coverImage ?? ""}
					onChange={(event) => article && onChange({ coverImage: event.target.value })}
					placeholder="https://example.com/cover.png"
				/>
				<div className="h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
					{article?.coverImage ? (
						<img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
					) : (
						<div className="flex h-full items-center justify-center text-xs text-slate-400">生成后将展示封面</div>
					)}
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-semibold text-slate-500">摘要</label>
					<Button variant="outline" size="sm" disabled={disabled || loading.summary} onClick={onGenerateSummary} type="button">
						AI 生成摘要
					</Button>
				</div>
				<Textarea
					disabled={disabled}
					value={article?.summary ?? ""}
					onChange={(event) => article && onChange({ summary: event.target.value })}
					placeholder="生成后可手动微调摘要"
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-semibold text-slate-500">标签</label>
					<Button variant="outline" size="sm" disabled={disabled || loading.tags} onClick={onGenerateTags} type="button">
						AI 生成标签
					</Button>
				</div>
				<EditableTagInput
					disabled={disabled}
					tags={article?.tags ?? []}
					onChange={(tags) => article && onChange({ tags })}
					placeholder="例如：React、工程化、性能优化"
				/>
				<p className="text-[11px] text-slate-400">点击 AI 按钮会覆盖当前标签。</p>
			</div>
		</div>
	);
}
