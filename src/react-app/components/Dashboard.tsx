import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountStatistics } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { AccountStatistics } from "@/react-app/types/publications";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";

interface DashboardProps {
  articles: Article[];
  onNavigate?: (tab: string) => void;
}

const platformLabels: Record<string, string> = {
  juejin: "掘金",
  zhihu: "知乎",
  xiaohongshu: "小红书",
  wechat: "公众号",
  csdn: "CSDN",
};

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

export function Dashboard({ articles, onNavigate }: DashboardProps) {
  const [accountStats, setAccountStats] = useState<AccountStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const stats = await getAccountStatistics();
        setAccountStats(stats);
      } catch (error) {
        console.error("加载看板统计数据失败", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const totalArticles = articles.length;
    const draftArticles = articles.filter((article) => article.status === "draft").length;
    const publishedArticles = articles.filter((article) => article.status === "published").length;

    const totalPublished = accountStats.reduce((sum, item) => sum + item.totalPublished, 0);
    const totalDrafts = accountStats.reduce((sum, item) => sum + item.totalDrafts, 0);
    const totalFailed = accountStats.reduce((sum, item) => sum + item.totalFailed, 0);
    const totalPlatforms = new Set(accountStats.map((item) => item.platform)).size;

    const platformRows = Object.values(
      accountStats.reduce<Record<string, { platform: string; published: number; drafts: number; failed: number }>>((acc, item) => {
        if (!acc[item.platform]) {
          acc[item.platform] = { platform: item.platform, published: 0, drafts: 0, failed: 0 };
        }
        acc[item.platform].published += item.totalPublished;
        acc[item.platform].drafts += item.totalDrafts;
        acc[item.platform].failed += item.totalFailed;
        return acc;
      }, {}),
    );

    const recentActivity = accountStats
      .flatMap((stat) =>
        stat.publishHistory.map((history) => ({
          platform: stat.platform,
          status: history.status,
          articleTitle: history.articleTitle,
          time: history.publishedAt,
        })),
      )
      .sort((a, b) => b.time - a.time)
      .slice(0, 8);

    return {
      totalArticles,
      draftArticles,
      publishedArticles,
      totalPublished,
      totalDrafts,
      totalFailed,
      totalPlatforms,
      platformRows,
      recentActivity,
    };
  }, [accountStats, articles]);

  const statCards = [
    { label: "文章总数", value: summary.totalArticles, detail: `草稿 ${summary.draftArticles} · 已发布 ${summary.publishedArticles}`, icon: FileText, color: "text-brand-500", bg: "bg-brand-50" },
    { label: "分发动作", value: summary.totalPublished + summary.totalDrafts, detail: `成功 ${summary.totalPublished} · 草稿 ${summary.totalDrafts}`, icon: Send, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "活跃平台", value: summary.totalPlatforms, detail: "已接入并产生统计", icon: Users, color: "text-violet-500", bg: "bg-violet-50" },
    { label: "失败记录", value: summary.totalFailed, detail: "需要回看与处理", icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
  ];

  return (
    <div className="space-y-5 page-enter">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-brand-50/30 p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-100/20 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-violet-100/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">内容分发工作台</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                查看文章储备、平台状态和最近分发结果。
              </p>
            </div>

            <div className="flex items-center gap-3">
              {[
                { label: "草稿", value: summary.draftArticles },
                { label: "已发布", value: summary.totalPublished },
                { label: "平台", value: summary.totalPlatforms },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{item.value}</p>
                  <p className="text-[11px] text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="stat-card group hover:shadow-card-hover transition-all duration-300">
              <CardContent className="flex items-start justify-between p-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-400">{card.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
                  <p className="mt-1.5 text-[11px] text-slate-400">{card.detail}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm">平台分发统计</CardTitle>
              <CardDescription className="mt-1">按平台查看发布、草稿和失败情况</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5 text-[10px]">
              <RefreshCw className="h-3 w-3" />
              实时
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-[13px] text-slate-400">
                正在加载统计数据...
              </div>
            ) : summary.platformRows.length === 0 ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-[13px] text-slate-400">
                还没有平台统计数据
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.platformRows.map((row) => {
                  const total = row.published + row.drafts + row.failed;
                  const successRatio = total > 0 ? (row.published / total) * 100 : 0;

                  return (
                    <div key={row.platform} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-slate-50">
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-600 shadow-sm">
                            {(platformLabels[row.platform] || row.platform).slice(0, 1)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-slate-800">{platformLabels[row.platform] || row.platform}</p>
                            <p className="text-[11px] text-slate-400">成功率 {Math.round(successRatio)}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">{row.published}</span>
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">{row.drafts}</span>
                          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">{row.failed}</span>
                        </div>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-700"
                          style={{ width: `${successRatio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">最近动态</CardTitle>
            <CardDescription className="mt-1">最近的分发记录和状态变更</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {summary.recentActivity.length === 0 ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-[13px] text-slate-400">
                  还没有分发记录
                </div>
              ) : (
                summary.recentActivity.map((activity, index) => {
                  const statusColor =
                    activity.status === "published" ? "bg-emerald-400" : activity.status === "draft_created" ? "bg-amber-400" : "bg-rose-400";

                  return (
                    <div
                      key={`${activity.articleTitle}-${activity.time}-${index}`}
                      className="rounded-lg border border-slate-100 bg-white p-3 transition-colors hover:bg-slate-50/50"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${statusColor}`} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">{activity.articleTitle}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{platformLabels[activity.platform] || activity.platform}</span>
                            <span>·</span>
                            <span>{getRelativeTime(activity.time)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/60 bg-white/80 p-3">
        <span className="mr-1 text-[12px] font-medium text-slate-400">快速入口</span>
        {[
          { label: "文章列表", tab: "articles" },
          { label: "分发状态", tab: "distribution" },
          { label: "平台账号", tab: "accounts" },
          { label: "平台设置", tab: "settings" },
        ].map((item) => (
          <Button key={item.tab} variant="ghost" size="xs" className="gap-1.5 text-slate-500" onClick={() => onNavigate?.(item.tab)}>
            {item.label}
            <ArrowRight className="h-3 w-3" />
          </Button>
        ))}
      </div>
    </div>
  );
}
