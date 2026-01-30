import type { Article } from "../types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Viewer } from "@bytemd/react";
import { format } from "@/lib/utils";
import {
	Calendar,
	Clock,
	Hash,
	ImageIcon,
	FileText,
	ExternalLink,
	CheckCircle2,
	Circle,
	Clock4,
	AlertCircle,
	XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ByteMD 插件
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import math from "@bytemd/plugin-math";

import "bytemd/dist/index.css";
import "highlight.js/styles/github.css";

interface ArticleDetailDialogProps {
	article: Article | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const plugins = [
	gfm(),
	highlight(),
	breaks(),
	frontmatter(),
	gemoji(),
	math(),
];

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

const statusConfig = {
	draft: {
		label: "草稿",
		icon: Circle,
		color: "bg-slate-100 text-slate-600",
		borderColor: "border-slate-200",
	},
	reviewed: {
		label: "已审核",
		icon: CheckCircle2,
		color: "bg-blue-100 text-blue-600",
		borderColor: "border-blue-200",
	},
	scheduled: {
		label: "定时发布",
		icon: Clock4,
		color: "bg-amber-100 text-amber-600",
		borderColor: "border-amber-200",
	},
	published: {
		label: "已发布",
		icon: CheckCircle2,
		color: "bg-emerald-100 text-emerald-600",
		borderColor: "border-emerald-200",
	},
	failed: {
		label: "发布失败",
		icon: XCircle,
		color: "bg-red-100 text-red-600",
		borderColor: "border-red-200",
	},
};

// 格式化日期时间
function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export function ArticleDetailDialog({
	article,
	open,
	onOpenChange,
}: ArticleDetailDialogProps) {
	if (!article) return null;

	const status = statusConfig[article.status];
	const StatusIcon = status.icon;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
				{/* 头部区域 */}
				<div className="relative">
					{/* 封面图背景 */}
					<div className="h-48 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
						{article.coverImage ? (
							<img
								src={article.coverImage}
								alt={article.title}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center">
								<ImageIcon className="h-16 w-16 text-slate-300" />
							</div>
						)}
						{/* 渐变遮罩 */}
						<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
					</div>

					{/* 标题区域 */}
					<div className="absolute bottom-0 left-0 right-0 p-6">
						<div className="flex items-start justify-between gap-4">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<Badge
										className={cn(
											"gap-1 px-2 py-0.5",
											status.color
										)}
									>
										<StatusIcon className="h-3 w-3" />
										{status.label}
									</Badge>
									{article.status === "published" && article.platform && (
										<Badge variant="outline" className="gap-1">
											<span>{platformIcons[article.platform]}</span>
											<span>{platformLabels[article.platform]}</span>
										</Badge>
									)}
								</div>
								<h1 className="text-2xl font-bold text-white drop-shadow-lg">
									{article.title || "未命名文章"}
								</h1>
							</div>
						</div>
					</div>
				</div>

				{/* 元信息区域 */}
				<div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100">
					<div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
						<div className="flex items-center gap-1">
							<Calendar className="h-3.5 w-3.5" />
							<span>创建: {formatDateTime(article.createdAt)}</span>
						</div>
						<div className="flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							<span>更新: {formatDateTime(article.updatedAt)}</span>
						</div>
						{article.publishedAt && (
							<div className="flex items-center gap-1 text-emerald-600">
								<CheckCircle2 className="h-3.5 w-3.5" />
								<span>发布: {formatDateTime(article.publishedAt)}</span>
							</div>
						)}
					</div>
				</div>

				<ScrollArea className="max-h-[calc(90vh-300px)]">
					<div className="p-6">
						{/* 摘要区域 */}
						{article.summary && (
							<div className="mb-6">
								<div className="rounded-lg bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-100 p-4">
									<h3 className="text-sm font-semibold text-brand-900 mb-2 flex items-center gap-2">
										<FileText className="h-4 w-4" />
										文章摘要
									</h3>
									<p className="text-sm text-slate-600 leading-relaxed">
										{article.summary}
									</p>
								</div>
							</div>
						)}

						{/* 标签区域 */}
						{article.tags && article.tags.length > 0 && (
							<div className="mb-6">
								<div className="flex items-center gap-2">
									<Hash className="h-4 w-4 text-slate-400" />
									<div className="flex flex-wrap gap-1.5">
										{article.tags.map((tag, i) => (
											<Badge
												key={i}
												variant="secondary"
												className="text-xs"
											>
												{tag}
											</Badge>
											))}
									</div>
								</div>
							</div>
						)}

						<Separator className="my-6" />

						{/* 文章内容区域 */}
						<div className="prose prose-slate max-w-none">
							<div className="bytemd-viewer">
								<Viewer value={article.content} plugins={plugins} />
							</div>
						</div>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
