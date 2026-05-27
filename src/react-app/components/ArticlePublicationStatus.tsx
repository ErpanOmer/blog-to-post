import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArticlePublication } from "@/react-app/types/publications";
import { getArticlePublications, getPlatformAccounts, validateArticlePublicationLinks } from "@/react-app/api";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ExternalLink, FileEdit, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "@/react-app/components/PlatformBrand";

interface ArticlePublicationStatusProps {
	articleId: string;
	refreshKey?: number;
}

const statusConfig = {
	pending: {
		label: "等待中",
		color: "border-design-border bg-design-background text-design-textSecondary",
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
		color: "border-design-border bg-design-background text-design-textSecondary",
		icon: XCircle,
	},
} as const;

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function getPublicationDedupeKey(publication: ArticlePublication): string {
	const rawUrl = publication.publishedUrl?.trim();
	if (!rawUrl) return `${publication.platform}:${publication.id}`;

	try {
		const parsed = new URL(rawUrl);
		const normalizedPath = parsed.pathname.replace(/\/+$/, "").toLowerCase();
		if (publication.platform === "website") {
			const slugMatch = normalizedPath.match(/\/blog\/([^/]+)/);
			if (slugMatch?.[1]) {
				return `${publication.platform}:slug:${safeDecodeURIComponent(slugMatch[1]).toLowerCase()}`;
			}
		}
		return `${publication.platform}:url:${parsed.origin.toLowerCase()}${normalizedPath}${parsed.search}`;
	} catch {
		return `${publication.platform}:url:${rawUrl.replace(/\/+$/, "").toLowerCase()}`;
	}
}

export function ArticlePublicationStatus({ articleId, refreshKey = 0 }: ArticlePublicationStatusProps) {
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
			setPublications([...pubs].sort((a, b) => b.updatedAt - a.updatedAt));

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
	}, [loadData, refreshKey]);

	useEffect(() => {
		setActivePlatform(null);
	}, [articleId]);

	const linkPublications = useMemo(() => {
		const seen = new Set<string>();
		return publications
			.filter((item) => Boolean(item.publishedUrl?.trim()))
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.filter((publication) => {
				const key = getPublicationDedupeKey(publication);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
	}, [publications]);

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

	const renderPublicationLink = (entry: { publication: ArticlePublication; sequence: number }) => {
		const { publication, sequence } = entry;
		const status = statusConfig[publication.status];
		const StatusIcon = status.icon;
		const accountName = accountNames.get(publication.accountId) || "未知账号";

		return (
			<div
				key={publication.id}
				className="rounded-lg border border-design-border bg-white px-3 py-2"
			>
				<div className="mb-1 flex items-center justify-between gap-2">
					<div className="inline-flex items-center gap-1 text-[12px] text-design-textSecondary">
						<span>#{sequence}</span>
						<StatusIcon className={cn("h-3 w-3", publication.status === "publishing" && "animate-spin")} />
					</div>
					<Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
				</div>
				<div className="text-[13px] text-design-textSecondary">{accountName}</div>
				<div className="mt-0.5 text-[12px] text-design-neutral">{new Date(publication.updatedAt).toLocaleString("zh-CN")}</div>
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
					<div className="mt-1 truncate text-[11px] text-design-neutral" title={publication.publishId}>
						ID: {publication.publishId}
					</div>
				)}
				{publication.errorMessage && <div className="mt-1 text-[11px] text-red-500">{publication.errorMessage}</div>}
			</div>
		);
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-1 text-[12px] text-design-neutral">
				<Loader2 className="h-3 w-3 animate-spin" />
				<span>加载中...</span>
			</div>
		);
	}

	if (linkPublications.length === 0) {
		if (publications.length > 0) {
			return <div className="text-[12px] text-design-neutral">存在分发记录，但暂无可访问链接</div>;
		}
		return <div className="text-[12px] text-design-neutral">尚未分发到任何平台</div>;
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-[12px] font-medium text-design-textSecondary">分发链接</span>
			<span className="mr-1 text-[12px] text-design-neutral">{linkPublications.length} 条</span>
			{isCheckingLinks ? <Loader2 className="h-3 w-3 animate-spin text-design-neutral" /> : null}
			{platformGroups.map(({ platform, entries }) => {
				const isActive = activePlatform === platform;
				const singlePublication = entries.length === 1 ? entries[0].publication : null;
				const triggerClassName = "inline-flex shrink-0 items-center gap-1 rounded-md border border-design-border bg-white px-1.5 py-0.5 text-[12px] text-design-textSecondary transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700";

				return (
					<div
						key={platform}
						className="relative"
						onMouseEnter={() => setActivePlatform(platform)}
						onMouseLeave={() => setActivePlatform(null)}
						onFocus={() => setActivePlatform(platform)}
						onBlur={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget)) {
								setActivePlatform(null);
							}
						}}
					>
						{singlePublication?.publishedUrl ? (
							<a
								href={singlePublication.publishedUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(triggerClassName, "hover:text-brand-700")}
								title={singlePublication.publishedUrl}
								onClick={(event) => event.stopPropagation()}
							>
								<PlatformBadge platform={platform} size="xs" className="border-0 bg-transparent px-0" />
								<span className="rounded bg-design-background px-1 py-0 text-[11px] text-design-textSecondary">{entries.length}</span>
								<ExternalLink className="h-3 w-3" />
							</a>
						) : (
							<button type="button" className={triggerClassName}>
								<PlatformBadge platform={platform} size="xs" className="border-0 bg-transparent px-0" />
								<span className="rounded bg-design-background px-1 py-0 text-[11px] text-design-textSecondary">{entries.length}</span>
							</button>
						)}
						<div
							className={cn(
								"absolute right-0 top-full z-50 w-[min(360px,calc(100vw-48px))] pt-2 transition-all duration-150",
								isActive ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0",
							)}
						>
							<div className="rounded-xl border border-design-border bg-white p-3 shadow-elevated">
								<div className="mb-2 flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<PlatformBadge platform={platform} size="xs" />
										<span className="text-[13px] font-semibold text-design-text">发布记录</span>
									</div>
									<span className="text-[12px] text-design-neutral">{entries.length} 条</span>
								</div>
								<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
									{entries.map((entry) => renderPublicationLink(entry))}
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
