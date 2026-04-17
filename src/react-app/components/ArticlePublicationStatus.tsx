import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArticlePublication } from "@/react-app/types/publications";
import { getArticlePublications, getPlatformAccounts } from "@/react-app/api";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, ExternalLink, FileEdit, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArticlePublicationStatusProps {
	articleId: string;
}

const platformLabels: Record<string, string> = {
	juejin: "掘金",
	zhihu: "知乎",
	xiaohongshu: "小红书",
	wechat: "公众号",
	csdn: "CSDN",
};

const platformIcons: Record<string, string> = {
	juejin: "J",
	zhihu: "Z",
	xiaohongshu: "X",
	wechat: "W",
	csdn: "C",
};

const statusConfig = {
	pending: {
		label: "等待中",
		color: "bg-slate-50 text-slate-500 border-slate-200",
		icon: Clock,
	},
	draft_created: {
		label: "草稿",
		color: "bg-amber-50 text-amber-600 border-amber-200/60",
		icon: FileEdit,
	},
	publishing: {
		label: "发布中",
		color: "bg-blue-50 text-blue-600 border-blue-200/60",
		icon: Loader2,
	},
	published: {
		label: "已发布",
		color: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
		icon: CheckCircle2,
	},
	failed: {
		label: "失败",
		color: "bg-red-50 text-red-600 border-red-200/60",
		icon: XCircle,
	},
	cancelled: {
		label: "已取消",
		color: "bg-slate-50 text-slate-500 border-slate-200",
		icon: XCircle,
	},
} as const;

export function ArticlePublicationStatus({ articleId }: ArticlePublicationStatusProps) {
	const [publications, setPublications] = useState<ArticlePublication[]>([]);
	const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
	const [isLoading, setIsLoading] = useState(true);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		try {
			const [pubs, accounts] = await Promise.all([
				getArticlePublications(articleId),
				getPlatformAccounts(),
			]);
			const sorted = [...pubs].sort((a, b) => b.updatedAt - a.updatedAt);
			setPublications(sorted);

			const nameMap = new Map<string, string>();
			accounts.forEach((account) => {
				nameMap.set(account.id, account.userName || "未命名账号");
			});
			setAccountNames(nameMap);
		} catch (error) {
			console.error("Load publication status failed", error);
		} finally {
			setIsLoading(false);
		}
	}, [articleId]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const platformLatestPublications = useMemo(() => {
		const latestByPlatform = new Map<string, ArticlePublication>();

		for (const publication of publications) {
			const existing = latestByPlatform.get(publication.platform);
			if (!existing) {
				latestByPlatform.set(publication.platform, publication);
				continue;
			}

			const existingScore = Number(Boolean(existing.publishedUrl)) * 10 + Number(existing.updatedAt);
			const candidateScore = Number(Boolean(publication.publishedUrl)) * 10 + Number(publication.updatedAt);
			if (candidateScore > existingScore) {
				latestByPlatform.set(publication.platform, publication);
			}
		}

		return [...latestByPlatform.values()].sort((a, b) => b.updatedAt - a.updatedAt);
	}, [publications]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-1 text-[11px] text-slate-400">
				<Loader2 className="h-3 w-3 animate-spin" />
				<span>加载中...</span>
			</div>
		);
	}

	if (platformLatestPublications.length === 0) {
		return <div className="text-[11px] text-slate-400">尚未分发到任何平台</div>;
	}

	const visiblePublications = platformLatestPublications.slice(0, 8);
	const hiddenCount = Math.max(0, platformLatestPublications.length - visiblePublications.length);

	return (
		<TooltipProvider>
			<div className="flex flex-wrap items-center gap-1">
				<span className="mr-0.5 text-[11px] text-slate-400">分发:</span>
				{visiblePublications.map((publication) => {
					const status = statusConfig[publication.status];
					const StatusIcon = status.icon;
					const accountName = accountNames.get(publication.accountId) || "未知账号";
					const hasOnlineUrl = Boolean(publication.publishedUrl?.trim());
					const badgeNode = (
						<Badge
							variant="outline"
							className={cn(
								"px-1.5 py-0 text-[10px] transition-opacity hover:opacity-90",
								status.color,
								hasOnlineUrl ? "cursor-pointer" : "cursor-default",
							)}
						>
							<span className="mr-0.5">{platformIcons[publication.platform]}</span>
							<span>{platformLabels[publication.platform] || publication.platform}</span>
							<StatusIcon className={cn("ml-0.5 h-2.5 w-2.5", publication.status === "publishing" && "animate-spin")} />
							{hasOnlineUrl && <ExternalLink className="ml-0.5 h-2.5 w-2.5" />}
						</Badge>
					);

					return (
						<Tooltip key={publication.id}>
							<TooltipTrigger asChild>
								{hasOnlineUrl ? (
									<a
										href={publication.publishedUrl ?? undefined}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(event) => event.stopPropagation()}
									>
										{badgeNode}
									</a>
								) : (
									badgeNode
								)}
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs">
								<div className="space-y-1.5 text-[11px]">
									<div className="font-medium">
										{platformLabels[publication.platform] || publication.platform}
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500">{accountName}</span>
										<Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
									</div>
									<div className="text-slate-400">{new Date(publication.updatedAt).toLocaleString("zh-CN")}</div>
									{publication.publishId && (
										<div className="truncate text-slate-400" title={publication.publishId}>
											ID: {publication.publishId}
										</div>
									)}
									{publication.errorMessage && <div className="text-red-500">{publication.errorMessage}</div>}
									{hasOnlineUrl && (
										<div className="inline-flex items-center gap-1 text-brand-500">
											<ExternalLink className="h-3 w-3" />
											点击标签可打开线上地址
										</div>
									)}
								</div>
							</TooltipContent>
						</Tooltip>
					);
				})}

				{hiddenCount > 0 && (
					<Badge variant="outline" className="text-[10px] text-slate-400">
						+{hiddenCount}
					</Badge>
				)}
			</div>
		</TooltipProvider>
	);
}
