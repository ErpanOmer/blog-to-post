import type { Article } from "../types";
import { Input } from "@/components/ui/input";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";

const plugins = [gfm()];

export function ArticleEditor({ article, onChange }: { article: Article | null; onChange: (draft: Article) => void }) {
	const disabled = !article;
	const title = article?.title ?? "";
	const content = article?.content ?? "";

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">标题（先通过左侧生成）</label>
				<Input
					value={title}
					disabled={disabled}
					onChange={(event) => {
						if (!article) return;
						onChange({ ...article, title: event.target.value });
					}}
					placeholder="生成后可在此微调标题"
				/>
			</div>
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label className="text-xs font-semibold text-slate-500">文章内容</label>
					<span className="text-[11px] text-slate-400">ByteMD 实时编辑，生成内容将覆盖填充</span>
				</div>
				<div className={disabled ? "pointer-events-none opacity-50" : ""}>
					<Editor
						value={content}
						plugins={plugins}
						onChange={(value) => {
							if (!article) return;
							onChange({ ...article, content: value });
						}}
					/>
				</div>
				{disabled && <p className="text-xs text-slate-400">先在左侧生成标题，系统会自动填充正文。</p>}
			</div>
		</div>
	);
}



