import type { Article } from "@/react-app/types";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Viewer } from "@bytemd/react";
import {
	Calendar,
	Clock,
	Hash,
	ImageIcon,
	FileText,
	CheckCircle2,
	Circle,
	Clock4,
	XCircle,
	Rocket,
	Pencil,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "@/react-app/components/PlatformBrand";

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
	onEdit?: (article: Article) => void;
	onDelete?: (article: Article) => void;
	onPublish?: (articles: Article[]) => void;
}

const plugins = [
	gfm(),
	highlight(),
	breaks(),
	frontmatter(),
	gemoji(),
	math(),
];

const statusConfig = {
	draft: {
		label: "草稿",
		icon: Circle,
		color: "bg-design-background text-design-textSecondary",
		borderColor: "border-design-border",
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
	onEdit,
	onDelete,
	onPublish,
}: ArticleDetailDialogProps) {
	if (!article) return null;

	const status = statusConfig[article.status];
	const StatusIcon = status.icon;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-visible border-none bg-transparent p-0 shadow-none sm:p-0">
				<div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-design-border bg-white shadow-elevated">
					<DialogTitle className="sr-only">
						{article.title || "文章详情"}
					</DialogTitle>
					{/* 头部区域 */}
					<div>
						{/* 封面图背景 */}
						<div className="h-48 w-full overflow-hidden border-b border-design-border bg-design-background">
							{article.coverImage ? (
								<img
									src={article.coverImage}
									alt={article.title}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center">
									<ImageIcon className="h-16 w-16 text-design-neutral" />
								</div>
							)}
							{/* 渐变遮罩 */}
							
						</div>

						{/* 标题区域 */}
						<div className="border-b border-design-border bg-white p-6">
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<div className="mb-2 flex items-center gap-2">
										<Badge
											className={cn(
												"gap-1 px-2 py-0.5",
												status.color,
											)}
										>
											<StatusIcon className="h-3 w-3" />
											{status.label}
										</Badge>
										{article.status === "published" && article.platform && (
											<PlatformBadge platform={article.platform} size="xs" />
										)}
									</div>
									<h1 className="font-display text-2xl font-semibold text-design-text">
										{article.title || "未命名文章"}
									</h1>
								</div>
							</div>
						</div>
					</div>

					{/* 元信息区域 */}
					<div className="border-b border-design-border bg-design-background px-6 py-3">
						<div className="flex flex-wrap items-center gap-4 text-[12px] text-design-textSecondary">
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

					<ScrollArea className="max-h-[calc(90vh-300px)] overflow-y-auto">
						<div className="p-6">
							{/* 摘要区域 */}
							{article.summary && (
								<div className="mb-6">
									<div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
										<h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-brand-900">
											<FileText className="h-4 w-4" />
											文章摘要
										</h3>
										<p className="text-[13px] leading-relaxed text-design-textSecondary">
											{article.summary}
										</p>
									</div>
								</div>
							)}

							{/* 标签区域 */}
							{article.tags && article.tags.length > 0 && (
								<div className="mb-6">
									<div className="flex items-center gap-2">
										<Hash className="h-4 w-4 text-design-neutral" />
										<div className="flex flex-wrap gap-1.5">
											{article.tags.map((tag, i) => (
												<Badge
													key={i}
													variant="secondary"
													className="text-[12px]"
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
				</div>

				{/* Floating Settings Bar (Right Side) */}
				<div className="absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col gap-4">
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-12 w-12 rounded-full border-design-border bg-white transition-colors hover:bg-brand-50 hover:text-brand-600"
									onClick={() => {
										onOpenChange(false);
										onPublish?.([article]);
									}}
								>
									<Rocket className="h-5 w-5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">
								<p>发布文章</p>
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-12 w-12 rounded-full border-design-border bg-white transition-colors hover:bg-brand-50 hover:text-brand-600"
									onClick={() => {
										onOpenChange(false);
										onEdit?.(article);
									}}
								>
									<Pencil className="h-5 w-5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">
								<p>编辑内容</p>
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-12 w-12 rounded-full border-design-border bg-white transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
									onClick={() => {
										// onDelete usually requires confirmation, handle in parent or here?
										// Parent handler usually has confirm logic.
										// But keeping dialog open might be weird if deleted.
										onDelete?.(article);
									}}
								>
									<Trash2 className="h-5 w-5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">
								<p className="text-red-600">删除文章</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</DialogContent>
		</Dialog>
	);
}
