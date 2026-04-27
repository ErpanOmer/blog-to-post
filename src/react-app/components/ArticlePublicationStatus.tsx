import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArticlePublication } from "@/react-app/types/publications";
import { getArticlePublications, getPlatformAccounts, validateArticlePublicationLinks } from "@/react-app/api";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, ExternalLink, FileEdit, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_DISPLAY_NAMES, PLATFORM_SHORT_ICONS, isPublishablePlatform } from "@/shared/platform-settings";

interface ArticlePublicationStatusProps {
	articleId: string;
}

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

function getPlatformLabel(platform: string): string {
	return isPublishablePlatform(platform) ? PLATFORM_DISPLAY_NAMES[platform] : platform;
}

function getPlatformIcon(platform: string): string {
	return isPublishablePlatform(platform) ? PLATFORM_SHORT_ICONS[platform] : "?";
}

export function ArticlePublicationStatus({ articleId }: ArticlePublicationStatusProps) {
	const [publications, setPublications] = useState<ArticlePublication[]>([]);
	const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
	const [activePlatform, setActivePlatform] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isCheckingLinks, setIsCheckingLinks] = useState(false);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		try {
			setIsCheckingLinks(true);
			const [pubs, accounts] = await Promise.all([
				validateArticlePublicationLinks(articleId).catch(async (error) => {
					console.warn("Validate publication links failed, fallback to cached publications", error);
					return getArticlePublications(articleId);
				}),
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
			setIsCheckingLinks(false);
			setIsLoading(false);
		}
	}, [articleId]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		setActivePlatform(null);
	}, [articleId]);

	const linkPublications = useMemo(
		() => publications.filter((item) => Boolean(item.publishedUrl?.trim())).sort((a, b) => b.updatedAt - a.updatedAt),
		[publications],
	);

	const platformGroups = useMemo(() => {
		const perPlatformCounter = new Map<string, number>();
		const byPlatform = new Map<string, Array<{ publication: ArticlePublication; sequence: number }>>();

		for (const publication of linkPublications) {
			const nextCount = (perPlatformCounter.get(publication.platform) ?? 0) + 1;
			perPlatformCounter.set(publication.platform, nextCount);
			const current = byPlatform.get(publication.platform) ?? [];
			current.push({ publication, sequence: nextCount });
			byPlatform.set(publication.platform, current);
		}

		return [...byPlatform.entries()]
			.map(([platform, entries]) => ({ platform, entries }))
			.sort((a, b) => b.entries[0].publication.updatedAt - a.entries[0].publication.updatedAt);
	}, [linkPublications]);

	const activeGroup = useMemo(
		() => (activePlatform ? platformGroups.find((group) => group.platform === activePlatform) ?? null : null),
		[activePlatform, platformGroups],
	);

	if (isLoading) {
		return (
			<div className="flex items-center gap-1 text-[11px] text-slate-400">
				<Loader2 className="h-3 w-3 animate-spin" />
				<span>加载中...</span>
			</div>
		);
	}

	if (linkPublications.length === 0) {
		if (publications.length > 0) {
			return <div className="text-[11px] text-slate-400">存在分发记录，但暂无可访问链接</div>;
		}
		return <div className="text-[11px] text-slate-400">尚未分发到任何平台</div>;
	}

	const renderPublicationLink = (entry: { publication: ArticlePublication; sequence: number }) => {
		const { publication, sequence } = entry;
		const status = statusConfig[publication.status];
		const StatusIcon = status.icon;
		const accountName = accountNames.get(publication.accountId) || "未知账号";

		return (
			<div
				key={publication.id}
				className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-[0_1px_0_0_rgba(148,163,184,0.08)]"
			>
				<div className="mb-1 flex items-center justify-between gap-2">
					<div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
						<span>#{sequence}</span>
						<StatusIcon className={cn("h-3 w-3", publication.status === "publishing" && "animate-spin")} />
					</div>
					<Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
				</div>
				<div className="text-[12px] text-slate-600">{accountName}</div>
				<div className="mt-0.5 text-[11px] text-slate-400">{new Date(publication.updatedAt).toLocaleString("zh-CN")}</div>
				<div className="mt-1">
					<a
						href={publication.publishedUrl ?? undefined}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700"
					>
						<ExternalLink className="h-3 w-3" />
						打开链接
					</a>
				</div>
				{publication.publishId && (
					<div className="mt-1 truncate text-[10px] text-slate-400" title={publication.publishId}>
						ID: {publication.publishId}
					</div>
				)}
				{publication.errorMessage && <div className="mt-1 text-[11px] text-red-500">{publication.errorMessage}</div>}
			</div>
		);
	};

	return (
		<>
			<div className="overflow-x-auto">
				<div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
					<span className="text-[11px] font-medium text-slate-500">分发链接</span>
					<span className="mr-1 text-[11px] text-slate-400">{linkPublications.length} 条</span>
					{isCheckingLinks ? <Loader2 className="h-3 w-3 animate-spin text-slate-300" /> : null}
					{platformGroups.map(({ platform, entries }) => (
						<button
							key={platform}
							type="button"
							onClick={() => setActivePlatform(platform)}
							className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
						>
							<span className="text-slate-500">{getPlatformIcon(platform)}</span>
							<span>{getPlatformLabel(platform)}</span>
							<span className="rounded bg-slate-100 px-1 py-0 text-[10px] text-slate-500">{entries.length}</span>
						</button>
					))}
				</div>
			</div>

			<Dialog open={Boolean(activeGroup)} onOpenChange={(open) => !open && setActivePlatform(null)}>
				<DialogContent className="max-h-[82vh] max-w-2xl overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="rounded-md border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
							>
								{activeGroup ? `${getPlatformIcon(activeGroup.platform)} ${getPlatformLabel(activeGroup.platform)}` : ""}
							</Badge>
							<span className="text-sm text-slate-500">{activeGroup?.entries.length ?? 0} 条发布记录</span>
						</DialogTitle>
					</DialogHeader>

					<ScrollArea className="max-h-[62vh] pr-2">
						<div className="space-y-2">{activeGroup?.entries.map((entry) => renderPublicationLink(entry))}</div>
					</ScrollArea>
				</DialogContent>
			</Dialog>
		</>
	);
}
