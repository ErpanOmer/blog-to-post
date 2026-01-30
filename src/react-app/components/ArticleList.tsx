import type { Article } from "../types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { FileText, Calendar, Hash, ChevronRight } from "lucide-react";

interface ArticleListProps {
	articles: Article[];
	selectedId?: string;
	onSelect: (id: string) => void;
}

const platformLabels: Record<string, string> = {
	juejin: "掘金",
	zhihu: "知乎",
	xiaohongshu: "小红书",
	wechat: "公众号",
};

const platformIcons: Record<string, string> = {
	juejin: "🔥",
	zhihu: "💡",
	xiaohongshu: "📕",
	wechat: "💬",
};

export function ArticleList({ articles, selectedId, onSelect }: ArticleListProps) {
	if (articles.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
					<FileText className="h-8 w-8 text-slate-400" />
				</div>
				<p className="text-sm font-medium text-slate-600">暂无文章</p>
				<p className="mt-1 text-xs text-slate-400">点击"生成文章"开始创作</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{articles.map((article, index) => (
				<button
					key={article.id}
					className={cn(
						"group relative flex w-full flex-col gap-3 rounded-xl border p-4 text-left",
						"transition-all duration-300 ease-out",
						selectedId === article.id
							? "border-brand-300 bg-gradient-to-br from-brand-50/80 to-white shadow-md"
							: "border-slate-200/70 bg-white/80 hover:border-brand-200 hover:bg-white hover:shadow-card"
					)}
					onClick={() => onSelect(article.id)}
					type="button"
					style={{ animationDelay: `${index * 50}ms` }}
				>
					{/* Selection indicator */}
					{selectedId === article.id && (
						<div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-violet-500" />
					)}

					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 min-w-0">
							<h3 className={cn(
								"text-sm font-semibold line-clamp-2 pr-2",
								selectedId === article.id ? "text-brand-900" : "text-slate-900 group-hover:text-brand-700"
							)}>
								{article.title || "未命名文章"}
							</h3>
						</div>
						<StatusBadge status={article.status} />
					</div>

					<div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
						<span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
							<span>{platformIcons[article.platform] || "📝"}</span>
							<span>{platformLabels[article.platform] || article.platform}</span>
						</span>
						<span className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							{new Date(article.updatedAt).toLocaleDateString()}
						</span>
					</div>

					{article.tags && article.tags.length > 0 && (
						<div className="flex items-center gap-1.5">
							<Hash className="h-3 w-3 text-slate-400" />
							<div className="flex flex-wrap gap-1">
								{article.tags.slice(0, 3).map((tag, i) => (
									<span
										key={i}
										className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
									>
										{tag}
									</span>
									))}
								{article.tags.length > 3 && (
									<span className="text-[10px] text-slate-400">
										+{article.tags.length - 3}
									</span>
									)}
							</div>
						</div>
					)}

					{/* Hover indicator */}
					<div className={cn(
						"absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity",
						"group-hover:opacity-100",
						selectedId === article.id && "opacity-0"
					)}>
						<ChevronRight className="h-4 w-4 text-slate-400" />
					</div>
				</button>
			))}
		</div>
	);
}
