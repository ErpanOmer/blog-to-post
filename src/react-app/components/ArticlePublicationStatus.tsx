import { useState, useEffect } from "react";
import type { ArticlePublication } from "../types/publications";
import { getArticlePublications, getPlatformAccounts } from "../api";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileEdit,
  ExternalLink,
  Loader2
} from "lucide-react";
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
  juejin: "🔥",
  zhihu: "💡",
  xiaohongshu: "📕",
  wechat: "💬",
  csdn: "💻",
};

const statusConfig = {
  pending: { 
    label: "等待中", 
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Clock 
  },
  draft_created: { 
    label: "草稿", 
    color: "bg-amber-100 text-amber-600 border-amber-200",
    icon: FileEdit 
  },
  publishing: { 
    label: "发布中", 
    color: "bg-blue-100 text-blue-600 border-blue-200",
    icon: Loader2 
  },
  published: { 
    label: "已发布", 
    color: "bg-emerald-100 text-emerald-600 border-emerald-200",
    icon: CheckCircle2 
  },
  failed: { 
    label: "失败", 
    color: "bg-red-100 text-red-600 border-red-200",
    icon: XCircle 
  },
  cancelled: { 
    label: "已取消", 
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: XCircle 
  },
};

export function ArticlePublicationStatus({ articleId }: ArticlePublicationStatusProps) {
  const [publications, setPublications] = useState<ArticlePublication[]>([]);
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [articleId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 并行加载发布记录和账号信息
      const [pubs, accounts] = await Promise.all([
        getArticlePublications(articleId),
        getPlatformAccounts(),
      ]);
      
      setPublications(pubs);
      
      // 构建账号ID到名称的映射
      const nameMap = new Map<string, string>();
      accounts.forEach(account => {
        nameMap.set(account.id, account.userName || "未命名");
      });
      setAccountNames(nameMap);
    } catch (err) {
      console.error("加载发布状态失败", err);
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
    return (
      <div className="text-xs text-slate-400">
        未发布到任何平台
      </div>
    );
  }

  // 按平台分组
  const publicationsByPlatform = publications.reduce((acc, pub) => {
    if (!acc[pub.platform]) {
      acc[pub.platform] = [];
    }
    acc[pub.platform].push(pub);
    return acc;
  }, {} as Record<string, ArticlePublication[]>);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500 mr-1">已发布到:</span>
        {Object.entries(publicationsByPlatform).map(([platform, platformPubs]) => {
          const latestPub = platformPubs[0]; // 最新的发布记录
          const status = statusConfig[latestPub.status];
          const StatusIcon = status.icon;
          
          return (
            <Tooltip key={platform}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity",
                    status.color
                  )}
                >
                  <span className="mr-1">{platformIcons[platform]}</span>
                  <StatusIcon className={cn("h-3 w-3 mr-1", latestPub.status === "publishing" && "animate-spin")} />
                  <span>{platformLabels[platform] || platform}</span>
                  {platformPubs.length > 1 && (
                    <span className="ml-1 opacity-60">×{platformPubs.length}</span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-medium flex items-center gap-2">
                    <span>{platformIcons[platform]}</span>
                    <span>{platformLabels[platform] || platform}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {platformPubs.slice(0, 3).map((pub, idx) => (
                      <div key={pub.id} className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">
                          {accountNames.get(pub.accountId) || "未知账号"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge className={cn("text-xs", statusConfig[pub.status].color)}>
                            {statusConfig[pub.status].label}
                          </Badge>
                          {pub.publishedUrl && (
                            <a 
                              href={pub.publishedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-brand-500 hover:text-brand-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {platformPubs.length > 3 && (
                      <div className="text-slate-400 text-xs">
                        还有 {platformPubs.length - 3} 个账号...
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 pt-1 border-t">
                    最新: {new Date(latestPub.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
