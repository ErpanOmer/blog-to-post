import { useEffect, useState } from "react";
import type { ArticlePublication } from "@/react-app/types/publications";
import { getArticlePublications, getPlatformAccounts } from "@/react-app/api";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, XCircle, FileEdit, ExternalLink, Loader2 } from "lucide-react";
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
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Clock,
  },
  draft_created: {
    label: "草稿",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: FileEdit,
  },
  publishing: {
    label: "发布中",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Loader2,
  },
  published: {
    label: "已发布",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "失败",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  cancelled: {
    label: "已取消",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: XCircle,
  },
} as const;

export function ArticlePublicationStatus({ articleId }: ArticlePublicationStatusProps) {
  const [publications, setPublications] = useState<ArticlePublication[]>([]);
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, [articleId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pubs, accounts] = await Promise.all([getArticlePublications(articleId), getPlatformAccounts()]);
      const sorted = [...pubs].sort((a, b) => b.createdAt - a.createdAt);
      setPublications(sorted);

      const nameMap = new Map<string, string>();
      accounts.forEach((account) => {
        nameMap.set(account.id, account.userName || "未命名账号");
      });
      setAccountNames(nameMap);
    } catch (error) {
      console.error("加载发布状态失败", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>加载中...</span>
      </div>
    );
  }

  if (publications.length === 0) {
    return <div className="text-xs text-slate-400">尚未分发到任何平台</div>;
  }

  const visiblePublications = publications.slice(0, 8);
  const hiddenCount = Math.max(0, publications.length - visiblePublications.length);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-slate-500">分发记录:</span>
        {visiblePublications.map((publication) => {
          const status = statusConfig[publication.status];
          const StatusIcon = status.icon;
          const accountName = accountNames.get(publication.accountId) || "未知账号";

          return (
            <Tooltip key={publication.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn("cursor-pointer px-1.5 py-0.5 text-xs transition-opacity hover:opacity-80", status.color)}
                >
                  <span className="mr-1">{platformIcons[publication.platform]}</span>
                  <span>{platformLabels[publication.platform] || publication.platform}</span>
                  <StatusIcon className={cn("ml-1 h-3 w-3", publication.status === "publishing" && "animate-spin")} />
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2 text-xs">
                  <div className="font-medium">
                    {platformLabels[publication.platform] || publication.platform}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">{accountName}</span>
                    <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
                  </div>
                  <div className="text-slate-500">时间: {new Date(publication.updatedAt).toLocaleString("zh-CN")}</div>
                  {publication.publishId && (
                    <div className="truncate text-slate-500" title={publication.publishId}>
                      ID: {publication.publishId}
                    </div>
                  )}
                  {publication.errorMessage && <div className="text-red-600">{publication.errorMessage}</div>}
                  {publication.publishedUrl && (
                    <a
                      href={publication.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      打开链接
                    </a>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {hiddenCount > 0 && (
          <Badge variant="outline" className="text-xs text-slate-500">
            +{hiddenCount}
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
