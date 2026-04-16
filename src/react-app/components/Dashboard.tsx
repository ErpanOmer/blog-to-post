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
  CheckCircle2,
  Clock,
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
    { label: "文章总数", value: summary.totalArticles, detail: `草稿 ${summary.draftArticles} / 已发布 ${summary.publishedArticles}`, icon: FileText },
    { label: "分发动作", value: summary.totalPublished + summary.totalDrafts, detail: `成功 ${summary.totalPublished} / 草稿 ${summary.totalDrafts}`, icon: Send },
    { label: "活跃平台", value: summary.totalPlatforms, detail: "已经接入并产生统计的平台", icon: Users },
    { label: "失败记录", value: summary.totalFailed, detail: "需要回看平台结果与日志", icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label mb-2">Overview</p>
            <h1 className="text-[28px] font-semibold text-slate-900">内容分发工作台</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              用来查看文章储备、平台状态和最近分发结果。整体上它应该更像一个内容运营工具，而不是展示型首页。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Drafts</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{summary.draftArticles}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Published</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{summary.totalPublished}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Platforms</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{summary.totalPlatforms}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Failures</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{summary.totalFailed}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">{card.detail}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <p className="eyebrow-label mb-2">Distribution Health</p>
              <CardTitle>平台分发统计</CardTitle>
              <CardDescription>按平台看发布、草稿和失败情况，方便你快速定位当前瓶颈。</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              实时汇总
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                正在加载统计数据...
              </div>
            ) : summary.platformRows.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                还没有平台统计数据
              </div>
            ) : (
              <div className="space-y-3">
                {summary.platformRows.map((row) => {
                  const total = row.published + row.drafts + row.failed;
                  const successRatio = total > 0 ? (row.published / total) * 100 : 0;

                  return (
                    <div key={row.platform} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-700">
                            {(platformLabels[row.platform] || row.platform).slice(0, 1)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{platformLabels[row.platform] || row.platform}</p>
                            <p className="text-xs text-slate-500">成功率 {Math.round(successRatio)}%</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge className="border-transparent bg-emerald-100 text-emerald-700">发布 {row.published}</Badge>
                          <Badge className="border-transparent bg-amber-100 text-amber-700">草稿 {row.drafts}</Badge>
                          <Badge className="border-transparent bg-rose-100 text-rose-700">失败 {row.failed}</Badge>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${successRatio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow-label mb-2">Recent Activity</p>
            <CardTitle>最近动态</CardTitle>
            <CardDescription>最近发生了什么，哪些文章刚刚推送出去，哪些任务出现了异常。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {summary.recentActivity.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  还没有分发记录
                </div>
              ) : (
                summary.recentActivity.map((activity, index) => {
                  const statusColor =
                    activity.status === "published" ? "bg-emerald-500" : activity.status === "draft_created" ? "bg-amber-500" : "bg-rose-500";

                  return (
                    <div
                      key={`${activity.articleTitle}-${activity.time}-${index}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusColor}`} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-slate-900">{activity.articleTitle}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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

      <section className="surface-panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow-label mb-2">Quick Entry</p>
            <h2 className="text-lg font-semibold text-slate-900">常用入口</h2>
            <p className="mt-1 text-sm text-slate-500">保留最常用的几个动作，不做营销式大卡片。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => onNavigate?.("articles")}>
              文章列表
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => onNavigate?.("distribution")}>
              分发状态
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => onNavigate?.("accounts")}>
              平台账号
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => onNavigate?.("settings")}>
              平台设置
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
