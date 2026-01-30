import type { ArticleStatus } from "../types";
import { cn } from "@/lib/utils";
import { FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const statusConfig: Record<ArticleStatus, { 
	label: string; 
	className: string;
	icon: React.ReactNode;
	gradient: string;
}> = {
	draft: { 
		label: "草稿", 
		className: "bg-slate-100 text-slate-700 border-slate-200",
		icon: <FileText className="h-3 w-3" />,
		gradient: "from-slate-500/10 to-slate-600/10"
	},
	reviewed: { 
		label: "待审核", 
		className: "bg-amber-50 text-amber-700 border-amber-200",
		icon: <AlertCircle className="h-3 w-3" />,
		gradient: "from-amber-500/10 to-orange-600/10"
	},
	scheduled: { 
		label: "已排期", 
		className: "bg-blue-50 text-blue-700 border-blue-200",
		icon: <Clock className="h-3 w-3" />,
		gradient: "from-blue-500/10 to-indigo-600/10"
	},
	published: { 
		label: "已发布", 
		className: "bg-emerald-50 text-emerald-700 border-emerald-200",
		icon: <CheckCircle className="h-3 w-3" />,
		gradient: "from-emerald-500/10 to-teal-600/10"
	},
	failed: { 
		label: "失败", 
		className: "bg-red-50 text-red-700 border-red-200",
		icon: <XCircle className="h-3 w-3" />,
		gradient: "from-red-500/10 to-rose-600/10"
	},
};

interface StatusBadgeProps {
	status: ArticleStatus;
	className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	const config = statusConfig[status];
	return (
		<span 
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
				"transition-all duration-200",
				config.className,
				className
			)}
		>
			<span className={cn(
				"flex h-4 w-4 items-center justify-center rounded-full",
				"bg-gradient-to-br",
				config.gradient
			)}>
				{config.icon}
			</span>
			{config.label}
		</span>
	);
}
