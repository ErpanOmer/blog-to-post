import type { Article } from "../types";
import { StatusBadge } from "./StatusBadge";

export function ArticleList({ articles, selectedId, onSelect }: { articles: Article[]; selectedId?: string; onSelect: (id: string) => void }) {
	return (
		<div className="space-y-3">
			{articles.map((article) => (
				<button
					key={article.id}
					className={`flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition hover:border-slate-300 ${
						selectedId === article.id ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"
					}`}
					onClick={() => onSelect(article.id)}
					type="button"
				>
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-slate-900">{article.title}</h3>
						<StatusBadge status={article.status} />
					</div>
					<p className="text-xs text-slate-500">平台：{article.platform} · 更新：{new Date(article.updatedAt).toLocaleString()}</p>
				</button>
			))}
		</div>
	);
}
