import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  Clock,
  FileText,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  SkipForward,
  Timer,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  clearPublishTasks,
  deletePublishTask,
  getArticles,
  getPublishTaskSteps,
  getPublishTasks,
} from "@/react-app/api";
import { PlatformBadge, PlatformLogo } from "@/react-app/components/PlatformBrand";
import { getPlatformDisplayName } from "@/react-app/components/platform-brand-data";
import type { Article } from "@/react-app/types";
import type { PublishTask, PublishTaskStatus, PublishTaskStep } from "@/react-app/types/publications";

interface TaskWithDetails extends PublishTask {
  steps?: PublishTaskStep[];
  articleTitles?: Map<string, string>;
}

interface DistributionStatusProps {
  initialTaskId?: string | null;
  onDeepLinkHandled?: () => void;
}

const PAGE_SIZE = 20;

const stepTypeLabels: Record<string, string> = {
  prepare_task: "准备任务",
  load_article: "加载文章",
  load_account: "加载账号",
  resolve_service: "初始化适配器",
  validate_account: "校验账号",
  create_draft: "创建草稿",
  publish_article: "正式发布",
  verify_result: "验证结果",
  persist_publication: "写入记录",
  update_statistics: "更新统计",
  adapter_trace: "适配器跟踪",
};

const stepStatusConfig: Record<string, { label: string; icon: ReactNode; className: string }> = {
  pending: { label: "待执行", icon: <Clock className="h-3.5 w-3.5" />, className: "text-design-neutral" },
  running: { label: "执行中", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-blue-500" },
  completed: { label: "已完成", icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "text-emerald-500" },
  failed: { label: "失败", icon: <XCircle className="h-3.5 w-3.5" />, className: "text-red-500" },
  skipped: { label: "已跳过", icon: <SkipForward className="h-3.5 w-3.5" />, className: "text-amber-500" },
  cancelled: { label: "已取消", icon: <XCircle className="h-3.5 w-3.5" />, className: "text-design-neutral" },
};

const taskStatusConfig: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  pending: { label: "待执行", badgeClass: "border-design-border bg-design-background text-design-textSecondary", dotClass: "bg-design-neutral" },
  processing: { label: "执行中", badgeClass: "border-blue-200 bg-blue-50 text-blue-700", dotClass: "bg-blue-500" },
  completed: { label: "已完成", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClass: "bg-emerald-500" },
  failed: { label: "失败", badgeClass: "border-red-200 bg-red-50 text-red-700", dotClass: "bg-red-500" },
  cancelled: { label: "已取消", badgeClass: "border-design-border bg-design-background text-design-textSecondary", dotClass: "bg-design-neutral" },
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 1000) return "<1s";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTaskDuration(task: PublishTask, now: number): string {
  if (!task.startedAt) return "未开始";
  const end = task.completedAt ?? (task.status === "processing" ? now : task.updatedAt);
  return formatDuration(Math.max(0, end - task.startedAt));
}

function formatProgressPair(current: number, total: number): string {
  if (total <= 0) return "0 / 0";
  return `${Math.max(0, Math.min(current, total))} / ${total}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusForFilter(filter: string): PublishTaskStatus | undefined {
  if (filter === "running") return "processing";
  if (filter === "scheduled") return "pending";
  if (filter === "completed") return "completed";
  if (filter === "failed") return "failed";
  return undefined;
}

function getTaskProgress(task: PublishTask): { done: number; progress: number } {
  const completed = task.progressData?.completedSteps ?? 0;
  const failed = task.progressData?.failedSteps ?? 0;
  const skipped = task.progressData?.skippedSteps ?? 0;
  const done = Math.min(completed + failed + skipped, task.totalSteps || 0);
  const progress = task.totalSteps > 0 ? Math.round((done / task.totalSteps) * 100) : 0;
  return { done, progress };
}

function getUniquePlatforms(task: PublishTask): string[] {
  return [...new Set(task.accountConfigs.map((item) => item.platform).filter(Boolean))];
}

function getUniqueAccountIds(task: PublishTask): string[] {
  return [...new Set(task.accountConfigs.map((item) => item.accountId).filter(Boolean))];
}

function isTaskDeletable(task: PublishTask): boolean {
  return task.status !== "processing";
}

export function DistributionStatus({ initialTaskId, onDeepLinkHandled }: DistributionStatusProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [taskSteps, setTaskSteps] = useState<Record<string, PublishTaskStep[]>>({});
  const [articleMap, setArticleMap] = useState<Map<string, Article>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [now, setNow] = useState(Date.now());
  const taskCountRef = useRef(0);

  const hydrateTasks = useCallback((taskList: PublishTask[]) => {
    return taskList.map((task) => {
      const articleTitles = new Map<string, string>();
      task.articleIds.forEach((id) => articleTitles.set(id, articleMap.get(id)?.title || "未命名文章"));
      return { ...task, articleTitles };
    });
  }, [articleMap]);

  const loadMetadata = useCallback(async () => {
    const allArticles = await getArticles();
    setArticleMap(new Map(allArticles.map((article) => [article.id, article])));
  }, []);

  const loadTasks = useCallback(async (mode: "reset" | "append" = "reset") => {
    const isAppend = mode === "append";
    if (isAppend) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const status = statusForFilter(activeFilter);
      const offset = isAppend ? taskCountRef.current : 0;
      const taskList = await getPublishTasks(status, PAGE_SIZE, offset);
      setHasMore(taskList.length === PAGE_SIZE);
      setTasks((prev) => {
        const hydrated = hydrateTasks(taskList);
        if (!isAppend) {
          taskCountRef.current = hydrated.length;
          return hydrated;
        }
        const seen = new Set(prev.map((task) => task.id));
        const next = [...prev, ...hydrated.filter((task) => !seen.has(task.id))];
        taskCountRef.current = next.length;
        return next;
      });
    } catch (error) {
      console.error("加载分发任务失败", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeFilter, hydrateTasks]);

  const openTaskDetail = useCallback(async (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDetailOpen(true);
    if (taskSteps[taskId]) return;

    try {
      const steps = await getPublishTaskSteps(taskId);
      setTaskSteps((prev) => ({
        ...prev,
        [taskId]: [...steps].sort((a, b) => a.stepNumber - b.stepNumber),
      }));
    } catch (error) {
      console.error("加载任务步骤失败", error);
    }
  }, [taskSteps]);

  const handleDeleteOne = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !isTaskDeletable(task)) return;
    if (!window.confirm("确认删除这个分发任务吗？对应的步骤日志也会一起删除。")) return;

    setIsMutating(true);
    try {
      await deletePublishTask(taskId);
      setTasks((prev) => prev.filter((item) => item.id !== taskId));
      setTaskSteps((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      if (selectedTaskId === taskId) setIsDetailOpen(false);
    } finally {
      setIsMutating(false);
    }
  }, [selectedTaskId, tasks]);

  const handleClearList = useCallback(async () => {
    const status = statusForFilter(activeFilter);
    if (status === "processing") return;
    const label = activeFilter === "all" ? "全部任务" : "当前筛选下的任务";
    if (!window.confirm(`确认清空${label}吗？这个操作会删除任务和步骤日志。`)) return;

    setIsMutating(true);
    try {
      await clearPublishTasks(status);
      await loadTasks("reset");
    } finally {
      setIsMutating(false);
    }
  }, [activeFilter, loadTasks]);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    void loadTasks("reset");
  }, [activeFilter, loadTasks]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hasActiveTasks = tasks.some((task) => task.status === "pending" || task.status === "processing");
    if (!hasActiveTasks) return;
    const timer = setInterval(() => void loadTasks("reset"), 5000);
    return () => clearInterval(timer);
  }, [loadTasks, tasks]);

  useEffect(() => {
    setTasks((prev) => hydrateTasks(prev));
  }, [hydrateTasks]);

  useEffect(() => {
    if (!initialTaskId || tasks.length === 0) return;
    const task = tasks.find((item) => item.id === initialTaskId);
    if (!task) return;
    void openTaskDetail(task.id);
    onDeepLinkHandled?.();
  }, [initialTaskId, onDeepLinkHandled, openTaskDetail, tasks]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    const task = tasks.find((item) => item.id === selectedTaskId);
    if (!task) return null;
    return { ...task, steps: taskSteps[selectedTaskId] };
  }, [selectedTaskId, taskSteps, tasks]);

  const summary = useMemo(() => ({
    total: tasks.length,
    running: tasks.filter((task) => task.status === "processing").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    failed: tasks.filter((task) => task.status === "failed" || task.status === "cancelled").length,
  }), [tasks]);

  const summaryCards = [
    { label: "当前加载", value: summary.total, icon: Layers, color: "text-design-textSecondary" },
    { label: "运行中", value: summary.running, icon: PlayCircle, color: "text-blue-600" },
    { label: "已完成", value: summary.completed, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "需处理", value: summary.failed, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-5 page-enter">
      <section className="rounded-xl border border-design-border bg-white p-5">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
              <CircleDotDashed className="h-3.5 w-3.5" />
              自动保留最近 7 天任务，旧任务会在进入页面时清理
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-normal text-design-text">分发任务中心</h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-design-textSecondary">
              快速确认每一次文章分发投递到哪些平台、用了哪些账号，以及当前执行到哪一步。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadTasks("reset")} disabled={isLoading || isMutating} className="gap-1.5 bg-white/80">
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              刷新
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleClearList()} disabled={isMutating || activeFilter === "running" || tasks.length === 0} className="gap-1.5 border-red-100 bg-white/80 text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
              清空列表
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="overflow-hidden border-design-border bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-design-neutral">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-design-text">{card.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-design-border bg-white">
                    <Icon className={cn("h-5 w-5", card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-design-border bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-blue-600" />
            任务列表
          </CardTitle>
          <CardDescription>
            展示平台、账号、进度与耗时；运行中任务会每秒刷新耗时，每 5 秒同步状态。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-4">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="running">执行中</TabsTrigger>
              <TabsTrigger value="scheduled">待执行</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
              <TabsTrigger value="failed">失败</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-design-neutral">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载任务...
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-design-border bg-design-background px-4 py-16 text-center text-[13px] text-design-neutral">
              <Layers className="mx-auto mb-2 h-9 w-9 text-design-neutral" />
              当前筛选下暂无任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  now={now}
                  isMutating={isMutating}
                  onOpen={openTaskDetail}
                  onDelete={handleDeleteOne}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={() => void loadTasks("append")} disabled={isLoadingMore} className="gap-1.5">
                    {isLoadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        task={selectedTask}
        now={now}
      />
    </div>
  );
}

function TaskCard(props: {
  task: TaskWithDetails;
  now: number;
  isMutating: boolean;
  onOpen: (taskId: string) => void | Promise<void>;
  onDelete: (taskId: string) => void | Promise<void>;
}) {
  const { task, now, isMutating, onOpen, onDelete } = props;
  const status = taskStatusConfig[task.status] || taskStatusConfig.pending;
  const { done, progress } = getTaskProgress(task);
  const accountIds = getUniqueAccountIds(task);
  const platformIds = getUniquePlatforms(task);
  const deletable = isTaskDeletable(task);

  return (
    <article className="group rounded-xl border border-design-border bg-white p-4">
      <div className="flex gap-3">
        <div
          role="button"
          tabIndex={0}
          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          onClick={() => void onOpen(task.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void onOpen(task.id);
            }
          }}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className={cn("border text-[11px]", status.badgeClass)}>
                  <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", status.dotClass, task.status === "processing" && "animate-pulse")} />
                  {status.label}
                </Badge>
                <span className="text-[12px] text-design-neutral">创建于 {formatDateTime(task.createdAt)}</span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]", task.status === "processing" ? "bg-blue-50 text-blue-700" : "bg-design-background text-design-textSecondary")}>
                  <Timer className="h-3 w-3" />
                  {task.status === "processing" ? "已运行" : "总耗时"} {formatTaskDuration(task, now)}
                </span>
                {task.status === "processing" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                    正在执行
                  </span>
                ) : null}
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {platformIds.map((platform) => (
                  <PlatformBadge key={platform} platform={platform} size="sm" />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[12px] text-design-textSecondary">
                <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-design-neutral" />{task.articleIds.length} 篇文章</span>
                <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-design-neutral" />{accountIds.length} 个账号</span>
                <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-design-neutral" />{platformIds.length} 个平台</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-design-neutral" />{formatProgressPair(done, task.totalSteps || 0)}</span>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[12px] text-design-neutral">
                  <span className="line-clamp-1">{task.progressData?.currentStep || "等待执行"}</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-design-background">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", task.status === "failed" ? "bg-red-400" : task.status === "completed" ? "bg-emerald-500" : "bg-brand-500", task.status === "processing" && "animate-pulse")}
                    style={{ width: `${Math.max(progress, task.status === "processing" ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 xl:pt-1" onClick={(event) => event.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-design-neutral hover:text-red-600" disabled={!deletable || isMutating} onClick={() => void onDelete(task.id)} title={deletable ? "删除任务" : "运行中的任务不能直接删除"}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-design-neutral" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TaskDetailDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: (TaskWithDetails & { steps?: PublishTaskStep[] }) | null;
  now: number;
}) {
  const { open, onOpenChange, task, now } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        {task && (
          <>
            <DialogHeader className="border-b border-design-border bg-design-background px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4 text-blue-600" />
                任务详情
              </DialogTitle>
              <DialogDescription>{formatDateTime(task.createdAt)} · {task.id}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-y-scroll px-5 py-4">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoBox label="Status">
                    <Badge className={cn("mt-2 border", taskStatusConfig[task.status]?.badgeClass)}>
                      {taskStatusConfig[task.status]?.label || task.status}
                    </Badge>
                  </InfoBox>
                  <InfoBox label="Progress">
                    <p className="mt-2 text-lg font-semibold tabular-nums text-design-text">{formatProgressPair(task.currentStep, task.totalSteps)}</p>
                  </InfoBox>
                  <InfoBox label="Duration">
                    <p className="mt-2 text-lg font-semibold tabular-nums text-design-text">{formatTaskDuration(task, now)}</p>
                  </InfoBox>
                  <InfoBox label="Updated">
                    <p className="mt-2 text-[13px] font-medium text-design-textSecondary">{formatDateTime(task.updatedAt)}</p>
                  </InfoBox>
                </div>

                <div className="rounded-xl border border-design-border bg-white p-3.5">
                  <h4 className="text-[13px] font-semibold text-design-text">投递范围</h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {getUniquePlatforms(task).map((platform) => (
                      <PlatformBadge key={platform} platform={platform} size="sm" />
                    ))}
                  </div>
                </div>

                {task.progressData && (
                  <div className="rounded-xl border border-design-border bg-white p-3.5">
                    <h4 className="text-[13px] font-semibold text-design-text">实时进度</h4>
                    <div className="mt-2.5 grid gap-1.5 text-[12px] text-design-textSecondary md:grid-cols-2">
                      <div>当前步骤：{task.progressData.currentStep}</div>
                      <div>步骤统计：完成 {task.progressData.completedSteps} / 失败 {task.progressData.failedSteps} / 跳过 {task.progressData.skippedSteps}</div>
                      <div>文章进度：{formatProgressPair(task.progressData.currentArticleIndex + 1, task.progressData.totalArticles)}</div>
                      <div>账号进度：{formatProgressPair(task.progressData.currentAccountIndex + 1, task.progressData.totalAccounts)}</div>
                    </div>
                  </div>
                )}

                {!task.steps ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-design-border bg-design-background py-12 text-[13px] text-design-neutral">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在加载步骤...
                  </div>
                ) : task.steps.length > 0 ? (
                  <div className="space-y-2">
                    {task.steps.map((step) => (
                      <StepCard key={step.id} step={step} task={task} />
                    ))}
                  </div>
                ) : null}

                {task.errorData && (
                  <div className="rounded-xl border border-red-100 bg-red-50/70 p-3.5">
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      任务错误信息
                    </h4>
                    <pre className="whitespace-pre-wrap text-[11px] text-red-600">{safeStringify(task.errorData)}</pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-design-border bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-design-neutral">{label}</p>
      {children}
    </div>
  );
}

function StepCard({ step, task }: { step: PublishTaskStep; task: TaskWithDetails }) {
  const status = stepStatusConfig[step.status] || stepStatusConfig.pending;
  const inputData = step.inputData ?? null;
  const outputData = step.outputData ?? null;
  const traceStage = step.stepType === "adapter_trace" && inputData && typeof inputData["stage"] === "string" ? String(inputData["stage"]) : null;
  const traceMessage = step.stepType === "adapter_trace"
    ? (outputData && typeof outputData["message"] === "string"
      ? String(outputData["message"])
      : inputData && typeof inputData["message"] === "string"
        ? String(inputData["message"])
        : null)
    : null;
  const stepLabel = step.stepType === "adapter_trace"
    ? traceStage ? `适配器跟踪 · ${traceStage}` : "适配器跟踪"
    : stepTypeLabels[step.stepType] || step.stepType;

  return (
    <div className="rounded-xl border border-design-border bg-white p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">#{step.stepNumber}</Badge>
        <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", status.className)}>
          {status.icon}
          {status.label}
        </span>
        <span className="text-[12px] text-design-textSecondary">{stepLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-design-neutral">
        <span className="inline-flex items-center gap-1">
          <PlatformLogo platform={step.platform} size="xs" className="ring-0 shadow-none" />
          {getPlatformDisplayName(step.platform)}
        </span>
        {step.articleId ? <span>文章：{task.articleTitles?.get(step.articleId) || "未知文章"}</span> : null}
        {step.duration != null ? <span>耗时：{formatDuration(step.duration)}</span> : null}
      </div>
      {traceMessage ? <div className="mt-2 rounded-md border border-design-border bg-design-background px-2.5 py-1.5 text-[12px] text-design-textSecondary">{traceMessage}</div> : null}
      {step.errorMessage ? (
        <div className="mt-2 rounded-md border border-red-100 bg-red-50/70 px-2.5 py-1.5 text-[11px] text-red-600">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          {step.errorMessage}
        </div>
      ) : null}
      {inputData && (
        <details className="mt-2 rounded-md border border-design-border bg-design-background p-2.5">
          <summary className="cursor-pointer text-[12px] font-medium text-design-textSecondary">输入数据</summary>
          <pre className="mt-1.5 overflow-x-auto text-[11px] text-design-textSecondary">{safeStringify(inputData)}</pre>
        </details>
      )}
      {outputData && (
        <details className="mt-2 rounded-md border border-design-border bg-design-background p-2.5">
          <summary className="cursor-pointer text-[12px] font-medium text-design-textSecondary">输出数据</summary>
          <pre className="mt-1.5 overflow-x-auto text-[11px] text-design-textSecondary">{safeStringify(outputData)}</pre>
        </details>
      )}
    </div>
  );
}
