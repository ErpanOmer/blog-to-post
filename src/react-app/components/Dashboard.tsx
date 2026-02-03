import { useEffect, useState } from "react";
import type { Article } from "@/react-app/types";
import type { AccountStatistics } from "@/react-app/types/publications";
import { getAccountStatistics } from "@/react-app/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Send, 
  Users, 
  Eye, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardProps {
  articles: Article[];
  onNavigate?: (tab: string) => void;
}

interface DashboardStats {
  totalArticles: number;
  draftArticles: number;
  publishedArticles: number;
  totalPublications: number;
  platformStats: {
    platform: string;
    totalPublished: number;
    totalDrafts: number;
    totalFailed: number;
    followers?: number;
    totalViews?: number;
  }[];
  recentActivity: {
    type: string;
    articleTitle: string;
    platform: string;
    time: number;
  }[];
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

export function Dashboard({ articles, onNavigate }: DashboardProps) {
  const [accountStats, setAccountStats] = useState<AccountStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await getAccountStatistics();
      setAccountStats(stats);
    } catch (error) {
      console.error("加载统计数据失败", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 计算统计数据
  const stats: DashboardStats = {
    totalArticles: articles.length,
    draftArticles: articles.filter(a => a.status === 'draft').length,
    publishedArticles: articles.filter(a => a.status === 'published').length,
    totalPublications: accountStats.reduce((sum, s) => sum + s.totalPublished + s.totalDrafts, 0),
    platformStats: Object.entries(
      accountStats.reduce((acc, stat) => {
        if (!acc[stat.platform]) {
          acc[stat.platform] = {
            platform: stat.platform,
            totalPublished: 0,
            totalDrafts: 0,
            totalFailed: 0,
            followers: 0,
            totalViews: 0,
          };
        }
        acc[stat.platform].totalPublished += stat.totalPublished;
        acc[stat.platform].totalDrafts += stat.totalDrafts;
        acc[stat.platform].totalFailed += stat.totalFailed;
        return acc;
      }, {} as Record<string, DashboardStats['platformStats'][0]>)
    ).map(([_, stat]) => stat),
    recentActivity: accountStats
      .flatMap(s => s.publishHistory.map(h => ({
        type: h.status === 'published' ? 'publish' : h.status === 'draft_created' ? 'draft' : 'fail' as const,
        articleTitle: h.articleTitle,
        platform: s.platform,
        time: h.publishedAt,
      })))
      .sort((a, b) => b.time - a.time)
      .slice(0, 10),
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  return (
    <div className="space-y-6">
      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">总文章数</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.totalArticles}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-slate-100">
                <FileText className="h-3 w-3 mr-1" />
                草稿 {stats.draftArticles}
              </Badge>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已发布 {stats.publishedArticles}
              </Badge>
            </div>
          </CardContent>
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <FileText className="h-16 w-16" />
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">总发布次数</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.totalPublications}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>跨 {stats.platformStats.length} 个平台</span>
            </div>
          </CardContent>
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <Send className="h-16 w-16" />
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">全平台粉丝</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {formatNumber(stats.platformStats.reduce((sum, p) => sum + (p.followers || 0), 0))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-3 w-3" />
              <span>累计关注者</span>
            </div>
          </CardContent>
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <Users className="h-16 w-16" />
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">总阅读量</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {formatNumber(stats.platformStats.reduce((sum, p) => sum + (p.totalViews || 0), 0))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Eye className="h-3 w-3" />
              <span>文章总曝光</span>
            </div>
          </CardContent>
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <Eye className="h-16 w-16" />
          </div>
        </Card>
      </div>

      {/* 平台分布和最近动态 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 平台发布统计 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-500" />
              <CardTitle className="text-lg">平台发布分布</CardTitle>
            </div>
            <CardDescription>各平台的文章发布情况统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.platformStats.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无平台数据</p>
                  <p className="text-xs mt-1">添加平台账号后开始统计</p>
                </div>
              ) : (
                stats.platformStats.map((platform) => (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{platformIcons[platform.platform]}</span>
                        <span className="font-medium">{platformLabels[platform.platform] || platform.platform}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-emerald-600 font-medium">{platform.totalPublished} 已发布</span>
                        <span className="text-amber-600">{platform.totalDrafts} 草稿</span>
                        {platform.totalFailed > 0 && (
                          <span className="text-red-600">{platform.totalFailed} 失败</span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, (platform.totalPublished / Math.max(1, stats.totalPublications)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近动态 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">最近动态</CardTitle>
            </div>
            <CardDescription>最近的发布活动记录</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {stats.recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">暂无动态</p>
                  </div>
                ) : (
                  stats.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        activity.type === 'publish' && "bg-emerald-500",
                        activity.type === 'draft' && "bg-amber-500",
                        activity.type === 'fail' && "bg-red-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.articleTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span>{platformIcons[activity.platform]} {platformLabels[activity.platform]}</span>
                          <span>•</span>
                          <span>{getRelativeTime(activity.time)}</span>
                        </div>
                      </div>
                      {activity.type === 'publish' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : activity.type === 'draft' ? (
                        <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-lg">快捷操作</CardTitle>
          </div>
          <CardDescription>常用功能快速入口</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all text-left group"
              onClick={() => onNavigate?.("articles")}
            >
              <div className="flex items-center justify-between mb-2">
                <FileText className="h-5 w-5 text-brand-500" />
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-500" />
              </div>
              <p className="font-medium text-sm">文章列表</p>
              <p className="text-xs text-slate-500 mt-1">管理所有文章</p>
            </button>
            
            <button 
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all text-left group"
              onClick={() => onNavigate?.("distribution")}
            >
              <div className="flex items-center justify-between mb-2">
                <Send className="h-5 w-5 text-emerald-500" />
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-500" />
              </div>
              <p className="font-medium text-sm">分发状态</p>
              <p className="text-xs text-slate-500 mt-1">查看发布进度</p>
            </button>
            
            <button 
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all text-left group"
              onClick={() => onNavigate?.("accounts")}
            >
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-violet-500" />
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-violet-500" />
              </div>
              <p className="font-medium text-sm">平台账号</p>
              <p className="text-xs text-slate-500 mt-1">管理发布账号</p>
            </button>
            
            <button 
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all text-left group"
              onClick={() => onNavigate?.("settings")}
            >
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-500" />
              </div>
              <p className="font-medium text-sm">平台设置</p>
              <p className="text-xs text-slate-500 mt-1">配置系统参数</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
