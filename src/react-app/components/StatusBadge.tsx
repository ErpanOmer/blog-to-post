import type { ArticleStatus } from "../types";
import { cn } from "@/lib/utils";

const statusMap: Record<ArticleStatus, { label: string; className: string }> = {
	draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
	reviewed: { label: "待审核", className: "bg-amber-100 text-amber-700" },
	scheduled: { label: "已排期", className: "bg-blue-100 text-blue-700" },
	published: { label: "已发布", className: "bg-emerald-100 text-emerald-700" },
	failed: { label: "失败", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
	const info = statusMap[status];
	return (
		<span className={cn("rounded-full px-3 py-1 text-xs font-semibold", info.className)}>
			{info.label}
		</span>
	);
}
