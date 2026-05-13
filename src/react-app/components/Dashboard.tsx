import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clipboard,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAccountStatistics, getPlatformAccounts, getPublications, getPublishTasks } from "@/react-app/api";
import type { Article, PlatformAccount, PlatformType } from "@/react-app/types";
import type { AccountStatistics, ArticlePublication, PublicationStatus, PublishTask } from "@/react-app/types/publications";
import { PlatformBadge, PlatformLogo, getPlatformBrand, getPlatformDisplayName } from "@/react-app/components/PlatformBrand";
import { PUBLISHABLE_PLATFORMS, isPublishablePlatform } from "@/shared/platform-settings";
import type { PublishablePlatformType } from "@/shared/types";

interface DashboardProps {
  articles: Article[];
  onNavigate?: (tab: string) => void;
}

type PlatformFilter = "all" | PublishablePlatformType;
type ActivityFilter = "all" | "published" | "draft_created" | "failed";
type TrendRange = 7 | 14 | 30;

type PlatformRollup = {
  platform: PublishablePlatformType;
  published: number;
  drafts: number;
  failed: number;
  total: number;
  successRate: number;
  lastPublishedAt: number | null;
  accounts: number;
  verifiedAccounts: number;
};

type ActivityItem = {
  id: string;
  platform: PlatformType;
  status: PublicationStatus;
  articleTitle: string;
  time: number;
  publishedUrl?: string | null;
  errorMessage?: string | null;
};

const activityFilters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "published", label: "正式" },
  { value: "draft_created", label: "草稿" },
  { value: "failed", label: "失败" },
];

const trendRanges: Array<{ value: TrendRange; label: string }> = [
  { value: 7, label: "7 天" },
  { value: 14, label: "14 天" },
  { value: 30, label: "30 天" },
];

function getRelativeTime(timestamp?: number | null): string {
  if (!timestamp) return "暂无记录";
  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(diff / 60000));
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusLabel(status: PublicationStatus | string): string {
  const labels: Record<string, string> = {
    pending: "等待中",
    draft_created: "草稿成功",
    publishing: "发布中",
    published: "正式发布",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function getStatusTone(status: PublicationStatus | string): string {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "draft_created") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "publishing") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function getArticleTitle(articleId: string, articles: Article[]): string {
  return articles.find((article) => article.id === articleId)?.title || articleId;
}

function getTaskDuration(task: PublishTask): number {
  const start = task.startedAt || task.createdAt;
  const end = task.completedAt || task.updatedAt || Date.now();
  return Math.max(0, end - start);
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function getTrend(publications: ArticlePublication[], range: TrendRange, platform: PlatformFilter) {
  const days = Array.from({ length: range }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (range - 1 - index));
    date.setHours(0, 0, 0, 0);
    return {
      key: formatDateKey(date),
      label: date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }),
      published: 0,
      drafts: 0,
      failed: 0,
    };
  });
  const indexByKey = new Map(days.map((day, index) => [day.key, index]));

  for (const publication of publications) {
    if (platform !== "all" && publication.platform !== platform) continue;
    const timestamp = publication.completedAt || publication.updatedAt || publication.createdAt;
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    const dayIndex = indexByKey.get(formatDateKey(date));
    if (dayIndex === undefined) continue;
    if (publication.status === "published") days[dayIndex].published += 1;
    if (publication.status === "draft_created") days[dayIndex].drafts += 1;
    if (publication.status === "failed") days[dayIndex].failed += 1;
  }

  const totals = days.reduce(
    (acc, day) => ({
      published: acc.published + day.published,
      drafts: acc.drafts + day.drafts,
      failed: acc.failed + day.failed,
    }),
    { published: 0, drafts: 0, failed: 0 },
  );
  const max = Math.max(1, ...days.map((day) => day.published + day.drafts + day.failed));
  return { days, max, totals };
}

function copyText(value?: string | null) {
  if (!value) return;
  void navigator.clipboard?.writeText(value).catch(() => undefined);
}

export function Dashboard({ articles, onNavigate }: DashboardProps) {
  const [accountStats, setAccountStats] = useState<AccountStatistics[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [publications, setPublications] = useState<ArticlePublication[]>([]);
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [trendPlatform, setTrendPlatform] = useState<PlatformFilter>("all");
  const [linkPlatform, setLinkPlatform] = useState<PlatformFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const [stats, platformAccounts, publicationHistory, recentTasks] = await Promise.all([
          getAccountStatistics(),
          getPlatformAccounts(),
          getPublications(),
          getPublishTasks(undefined, 80),
        ]);
        setAccountStats(stats);
        setAccounts(platformAccounts);
        setPublications(publicationHistory);
        setTasks(recentTasks);
      } catch (error) {
        console.error("加载 Dashboard 数据失败", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const totalArticles = articles.length;
    const totalFormalPublished = publications.filter((item) => item.status === "published").length;
    const totalDraftPublished = publications.filter((item) => item.status === "draft_created").length;
    const totalFailed = publications.filter((item) => item.status === "failed").length;
    const activePlatforms = new Set(publications.map((item) => item.platform).filter(isPublishablePlatform)).size;

    const platformRows: PlatformRollup[] = PUBLISHABLE_PLATFORMS.map((platform) => {
      const platformPublications = publications.filter((item) => item.platform === platform);
      const published = platformPublications.filter((item) => item.status === "published").length;
      const drafts = platformPublications.filter((item) => item.status === "draft_created").length;
      const failed = platformPublications.filter((item) => item.status === "failed").length;
      const total = published + drafts + failed;
      const accountList = accounts.filter((account) => account.platform === platform);
      const lastStat = accountStats
        .filter((item) => item.platform === platform)
        .map((item) => item.lastPublishedAt || 0)
        .sort((a, b) => b - a)[0] || null;

      return {
        platform,
        published,
        drafts,
        failed,
        total,
        successRate: total > 0 ? Math.round(((published + drafts) / total) * 100) : 0,
        lastPublishedAt: lastStat,
        accounts: accountList.length,
        verifiedAccounts: accountList.filter((account) => account.isActive && account.isVerified).length,
      };
    }).sort((a, b) => b.total - a.total || b.successRate - a.successRate);

    const allActivity: ActivityItem[] = publications
      .map((publication) => ({
        id: publication.id,
        platform: publication.platform,
        status: publication.status,
        articleTitle: getArticleTitle(publication.articleId, articles),
        time: publication.completedAt || publication.updatedAt || publication.createdAt,
        publishedUrl: publication.publishedUrl,
        errorMessage: publication.errorMessage,
      }))
      .sort((a, b) => b.time - a.time);

    const recentActivity = allActivity
      .filter((activity) => activityFilter === "all" || activity.status === activityFilter)
      .slice(0, 10);

    const recentPublishedLinks = publications
      .filter((publication) => publication.status === "published" && Boolean(publication.publishedUrl?.trim()))
      .filter((publication) => linkPlatform === "all" || publication.platform === linkPlatform)
      .sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt))
      .slice(0, 8)
      .map((publication) => ({
        ...publication,
        articleTitle: getArticleTitle(publication.articleId, articles),
      }));

    const averageTaskDuration = tasks.length > 0 ? Math.round(tasks.reduce((sum, task) => sum + getTaskDuration(task), 0) / tasks.length) : 0;
    const trend = getTrend(publications, trendRange, trendPlatform);

    return {
      totalArticles,
      totalFormalPublished,
      totalDraftPublished,
      totalSuccessful: totalFormalPublished + totalDraftPublished,
      totalFailed,
      activePlatforms,
      platformRows,
      recentActivity,
      recentPublishedLinks,
      trend,
      verifiedAccounts: accounts.filter((account) => account.isActive && account.isVerified).length,
      totalAccounts: accounts.length,
      averageTaskDuration,
    };
  }, [accountStats, accounts, activityFilter, articles, linkPlatform, publications, tasks, trendPlatform, trendRange]);

  const statCards = [
    {
      label: "文章总数",
      value: summary.totalArticles,
      detail: "本地工作台已保存的文章",
      icon: FileText,
      color: "text-blue-600",
      bg: "from-blue-50 to-white",
    },
    {
      label: "正式发布",
      value: summary.totalFormalPublished,
      detail: `草稿成功 ${summary.totalDraftPublished} · 总成功 ${summary.totalSuccessful}`,
      icon: Send,
      color: "text-emerald-600",
      bg: "from-emerald-50 to-white",
    },
    {
      label: "活跃平台",
      value: summary.activePlatforms,
      detail: `可用账号 ${summary.verifiedAccounts}/${summary.totalAccounts}`,
      icon: Users,
      color: "text-orange-600",
      bg: "from-orange-50 to-white",
    },
    {
      label: "失败记录",
      value: summary.totalFailed,
      detail: `平均任务耗时 ${formatDuration(summary.averageTaskDuration)}`,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "from-rose-50 to-white",
    },
  ];

  const platformFilterOptions: Array<{ value: PlatformFilter; label: string }> = [
    { value: "all", label: "全部平台" },
    ...PUBLISHABLE_PLATFORMS.map((platform) => ({ value: platform, label: getPlatformDisplayName(platform) })),
  ];

  return (
    <div className="space-y-4 page-enter">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc)] p-5 shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-12 left-10 h-36 w-36 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-3 border-blue-100 bg-white/70 text-blue-700">
              <Sparkles className="mr-1 h-3 w-3" />
              内容分发驾驶舱
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">内容分发工作台</h1>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">
              聚焦最近分发趋势、正式发布成果和平台健康状态，把真正需要看的信息放在第一屏。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="w-fit gap-1.5 bg-white/80" onClick={() => onNavigate?.("articles")}>文章列表</Button>
            <Button variant="outline" size="sm" className="w-fit gap-1.5 bg-white/80" onClick={() => onNavigate?.("distribution")}>
              查看分发任务
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className={cn("overflow-hidden border-slate-200/70 bg-gradient-to-br shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md", card.bg)}>
              <CardContent className="flex items-start justify-between p-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-400">{card.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-950">{card.value}</p>
                  <p className="mt-1.5 text-[11px] text-slate-400">{card.detail}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Icon className={cn("h-4 w-4", card.color)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  分发趋势
                </CardTitle>
                <CardDescription className="mt-1">可按时间范围和平台查看正式、草稿、失败走势。</CardDescription>
              </div>
              <div className="flex flex-wrap justify-start gap-1.5 lg:justify-end">
                {trendRanges.map((item) => (
                  <Button key={item.value} type="button" size="xs" variant={trendRange === item.value ? "default" : "outline"} onClick={() => setTrendRange(item.value)}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {platformFilterOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTrendPlatform(item.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    trendPlatform === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {item.value !== "all" ? <PlatformLogo platform={item.value} size="xs" className="ring-0 shadow-none" /> : null}
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
              <div className="flex h-56 items-end gap-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:gap-2">
                {summary.trend.days.map((day) => {
                  const total = day.published + day.drafts + day.failed;
                  const height = total > 0 ? Math.max(12, (total / summary.trend.max) * 100) : 5;
                  const compact = trendRange === 30;
                  return (
                    <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-lg bg-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                        style={{ height: `${height}%` }}
                        title={`${day.label}: 正式 ${day.published} / 草稿 ${day.drafts} / 失败 ${day.failed}`}
                      >
                        {day.failed > 0 ? <div className="bg-rose-400" style={{ height: `${(day.failed / Math.max(total, 1)) * 100}%` }} /> : null}
                        {day.drafts > 0 ? <div className="bg-amber-400" style={{ height: `${(day.drafts / Math.max(total, 1)) * 100}%` }} /> : null}
                        {day.published > 0 ? <div className="bg-emerald-500" style={{ height: `${(day.published / Math.max(total, 1)) * 100}%` }} /> : null}
                      </div>
                      {!compact || day.key.endsWith("01") || day.label.endsWith("01") ? <span className="text-[10px] text-slate-400">{day.label}</span> : null}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <p className="text-[11px] text-emerald-600">正式发布</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">{summary.trend.totals.published}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <p className="text-[11px] text-amber-600">草稿成功</p>
                  <p className="mt-1 text-xl font-semibold text-amber-700">{summary.trend.totals.drafts}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                  <p className="text-[11px] text-rose-600">失败记录</p>
                  <p className="mt-1 text-xl font-semibold text-rose-700">{summary.trend.totals.failed}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4 text-blue-500" />
                  近期正式发布链接
                </CardTitle>
                <CardDescription className="mt-1">只展示线上发布成功且可打开的 URL。</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">{summary.recentPublishedLinks.length} 条</Badge>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {platformFilterOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLinkPlatform(item.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    linkPlatform === item.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {item.value !== "all" ? <PlatformLogo platform={item.value} size="xs" className="ring-0 shadow-none" /> : null}
                  {item.label.replace("平台", "")}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[332px] space-y-2 overflow-y-auto pr-1">
              {summary.recentPublishedLinks.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-[13px] text-slate-400">暂无正式发布链接</div>
              ) : summary.recentPublishedLinks.map((publication) => (
                <div key={publication.id} className="group rounded-xl border border-slate-100 bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-slate-50/80 hover:shadow-sm">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <PlatformBadge platform={publication.platform} size="xs" />
                    <span className="text-[10px] text-slate-400">{getRelativeTime(publication.completedAt || publication.updatedAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">{publication.articleTitle}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[10px] text-slate-400">{publication.publishedUrl}</span>
                    <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="复制链接" onClick={() => copyText(publication.publishedUrl)}>
                        <Clipboard className="h-3.5 w-3.5" />
                      </Button>
                      <a href={publication.publishedUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-blue-600" title="打开链接">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                平台健康排行
              </CardTitle>
              <CardDescription className="mt-1">按发布量、成功率和账号可用性查看平台状态。</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5 text-[10px]">
              <RefreshCw className="h-3 w-3" />
              实时
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-[13px] text-slate-400">正在加载统计数据...</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {summary.platformRows.map((row) => {
                  const brand = getPlatformBrand(row.platform);
                  return (
                    <div key={row.platform} className="rounded-xl border border-slate-100 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <PlatformLogo platform={row.platform} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-slate-900">{getPlatformDisplayName(row.platform)}</p>
                            <p className="text-[10px] text-slate-400">账号 {row.verifiedAccounts}/{row.accounts} · {getRelativeTime(row.lastPublishedAt)}</p>
                          </div>
                        </div>
                        <span className="text-[12px] font-semibold text-slate-500">{row.successRate}%</span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1">
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">正式 {row.published}</span>
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">草稿 {row.drafts}</span>
                        <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">失败 {row.failed}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full transition-all duration-700", brand?.logoClass ?? "bg-slate-700")} style={{ width: `${Math.max(3, row.successRate)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">最近动态</CardTitle>
                <CardDescription className="mt-1">按状态筛选最新分发记录，失败会展示错误摘要。</CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activityFilters.map((item) => (
                  <Button key={item.value} type="button" size="xs" variant={activityFilter === item.value ? "default" : "outline"} onClick={() => setActivityFilter(item.value)}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
              {summary.recentActivity.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-[13px] text-slate-400">当前筛选下暂无动态</div>
              ) : summary.recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-xl border border-slate-100 bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-slate-50/80 hover:shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <PlatformLogo platform={activity.platform} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px]", getStatusTone(activity.status))}>{getStatusLabel(activity.status)}</Badge>
                        <span className="text-[11px] text-slate-400">{getRelativeTime(activity.time)}</span>
                        {activity.publishedUrl ? (
                          <a href={activity.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700">
                            链接
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">{activity.articleTitle}</p>
                      {activity.errorMessage ? <p className="mt-1 line-clamp-1 text-[11px] text-rose-500">{activity.errorMessage}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
