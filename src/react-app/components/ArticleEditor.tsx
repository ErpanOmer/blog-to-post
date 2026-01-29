import type { Article, PlatformType } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ArticleEditor({ article, onChange, onSave, onRegenerate }: {
	article: Article | null;
	onChange: (draft: Article) => void;
	onSave: () => void;
	onRegenerate: () => void;
}) {
	if (!article) {
		return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">请选择一篇文章后开始编辑。</div>;
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-4 md:grid-cols-[1fr_200px]">
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">标题</label>
					<Input value={article.title} onChange={(event) => onChange({ ...article, title: event.target.value })} />
				</div>
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">平台</label>
					<Select value={article.platform} onValueChange={(value) => onChange({ ...article, platform: value as PlatformType })}>
						<SelectTrigger>
							<SelectValue placeholder="选择平台" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="juejin">掘金</SelectItem>
							<SelectItem value="zhihu">知乎</SelectItem>
							<SelectItem value="xiaohongshu">小红书</SelectItem>
							<SelectItem value="wechat">公众号</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">文章内容</label>
				<Textarea value={article.content} onChange={(event) => onChange({ ...article, content: event.target.value })} />
			</div>
			<div className="flex flex-wrap gap-3">
				<Button onClick={onSave} type="button">保存草稿</Button>
				<Button variant="secondary" onClick={onRegenerate} type="button">AI 重新生成</Button>
			</div>
		</div>
	);
}
