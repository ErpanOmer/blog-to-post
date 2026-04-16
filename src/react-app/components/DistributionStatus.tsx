import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  SkipForward,
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
import { getArticles, getPublishTaskSteps, getPublishTasks } from "@/react-app/api";
import type { Article } from "@/react-app/types";
import type { PublishTask, PublishTaskStep } from "@/react-app/types/publications";

interface TaskWithDetails extends PublishTask {
  steps?: PublishTaskStep[];
  articleTitles?: Map<string, string>;
}

interface DistributionStatusProps {
  initialTaskId?: string | null;
  onDeepLinkHandled?: () => void;
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

const stepTypeLabels: Record<string, string> = {
  prepare_task: "准备任务",
  load_article: "加载文章",
  load_account: "加载账号",
  resolve_service: "初始化服务",
  validate_account: "校验账号",
  create_draft: "创建草稿",
  publish_article: "正式发布",
  verify_result: "验证结果",
  persist_publication: "写入发布记录",
  update_statistics: "更新统计",
  adapter_trace: "适配器跟踪",
};

const stepStatusConfig: Record<string, { label: string; icon: ReactNode; className: string }> = {
  pending: { label: "待执行", icon: <Clock className="h-4 w-4" />, className: "text-slate-500" },
  running: { label: "执行中", icon: <Loader2 className="h-4 w-4 animate-spin" />, className: "text-brand-600" },
  completed: { label: "已完成", icon: <CheckCircle2 className="h-4 w-4" />, className: "text-emerald-600" },
  failed: { label: "失败", icon: <XCircle className="h-4 w-4" />, className: "text-red-600" },
  skipped: { label: "已跳过", icon: <SkipForward className="h-4 w-4" />, className: "text-amber-600" },
  cancelled: { label: "已取消", icon: <XCircle className="h-4 w-4" />, className: "text-slate-400" },
};

const taskStatusConfig: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: "待执行", badgeClass: "border-slate-200 bg-slate-100 text-slate-700" },
  processing: { label: "执行中", badgeClass: "border-blue-200 bg-blue-50 text-blue-700" },
  completed: { label: "已完成", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "失败", badgeClass: "border-red-200 bg-red-50 text-red-700" },
  cancelled: { label: "已取消", badgeClass: "border-slate-200 bg-slate-100 text-slate-600" },
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatProgressPair(current: number, total: number): string {
  if (total <= 0) return "0 / 0";
  const normalized = Math.max(0, Math.min(current, total));
  return `${normalized} / ${total}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function DistributionStatus({ initialTaskId, onDeepLinkHandled }: DistributionStatusProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [taskList, allArticles] = await Promise.all([getPublishTasks(), getArticles()]);
      const articleMap = new Map<string, Article>();
      allArticles.forEach((article) => articleMap.set(article.id, article));

      const tasksWithDetails = await Promise.all(
        taskList.map(async (task) => {
          const steps = await getPublishTaskSteps(task.id);
          const articleTitles = new Map<string, string>();
          task.articleIds.forEach((id) => articleTitles.set(id, articleMap.get(id)?.title || "未命名文章"));

          return {
            ...task,
            steps: [...steps].sort((a, b) => a.stepNumber - b.stepNumber),
            articleTitles,
          };
        }),
      );

      setTasks(tasksWithDetails);
    } catch (error) {
      console.error("加载分发任务失败", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!initialTaskId || tasks.length === 0) return;
    const task = tasks.find((item) => item.id === initialTaskId);
    if (!task) return;
    setSelectedTaskId(task.id);
    setIsDetailOpen(true);
    onDeepLinkHandled?.();
  }, [initialTaskId, onDeepLinkHandled, tasks]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null),
    [selectedTaskId, tasks],
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "running") return task.status === "processing";
      if (activeFilter === "scheduled") return task.status === "pending";
      if (activeFilter === "completed") return task.status === "completed";
      if (activeFilter === "failed") return task.status === "failed" || task.status === "cancelled";
      return true;
    });
  }, [activeFilter, tasks]);

  const summary = useMemo(
    () => ({
      total: tasks.length,
      running: tasks.filter((task) => task.status === "processing").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      failed: tasks.filter((task) => task.status === "failed" || task.status === "cancelled").length,
    }),
    [tasks],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Tasks</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-slate-900">{summary.total}</p>
              <Layers className="h-5 w-5 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Running</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-brand-600">{summary.running}</p>
              <PlayCircle className="h-5 w-5 text-brand-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Completed</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-emerald-600">{summary.completed}</p>
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Failed</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-semibold text-red-600">{summary.failed}</p>
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-600" />
                分发任务看板
              </CardTitle>
              <CardDescription>查看任务队列、执行进度、失败步骤和适配器日志，风格统一为后台任务监控页。</CardDescription>
            </div>

            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="running">执行中</TabsTrigger>
              <TabsTrigger value="scheduled">待执行</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
              <TabsTrigger value="failed">失败</TabsTrigger>
            </TabsList>
          </Tabs>

          <ScrollArea className="h-[560px]">
            {isLoading && filteredTasks.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                正在加载任务...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-slate-500">
                <Layers className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                当前筛选下暂无任务。
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const status = taskStatusConfig[task.status] || taskStatusConfig.pending;
                  const completed = task.progressData?.completedSteps ?? task.steps?.filter((step) => step.status === "completed").length ?? 0;
                  const failed = task.progressData?.failedSteps ?? task.steps?.filter((step) => step.status === "failed").length ?? 0;
                  const skipped = task.progressData?.skippedSteps ?? task.steps?.filter((step) => step.status === "skipped").length ?? 0;
                  const done = Math.min(completed + failed + skipped, task.totalSteps || 0);
                  const progress = task.totalSteps > 0 ? Math.round((done / task.totalSteps) * 100) : 0;
                  const accountCount = new Set(task.accountConfigs.map((item) => item.accountId)).size;
                  const platformCount = new Set(task.accountConfigs.map((item) => item.platform)).size;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className={cn("border text-xs", status.badgeClass)}>{status.label}</Badge>
                            <span className="text-xs text-slate-400">创建于 {formatDateTime(task.createdAt)}</span>
                            {task.scheduleTime ? <span className="text-xs text-slate-400">排期 {formatDateTime(task.scheduleTime)}</span> : null}
                          </div>

                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                            <span className="inline-flex items-center gap-1.5">
                              <FileText className="h-4 w-4 text-slate-400" />
                              文章 {task.articleIds.length}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-4 w-4 text-slate-400" />
                              账号 {accountCount}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Layers className="h-4 w-4 text-slate-400" />
                              平台 {platformCount}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-slate-400" />
                              步骤 {formatProgressPair(done, task.totalSteps || 0)}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                              <span>{task.progressData?.currentStep || "等待执行"}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
          {selectedTask && (
            <>
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Layers className="h-5 w-5 text-brand-600" />
                  任务详情
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  创建时间 {formatDateTime(selectedTask.createdAt)} · 任务 ID {selectedTask.id}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 px-6 py-5">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Status</p>
                      <Badge className={cn("mt-3 border", taskStatusConfig[selectedTask.status]?.badgeClass)}>
                        {taskStatusConfig[selectedTask.status]?.label || selectedTask.status}
                      </Badge>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Progress</p>
                      <p className="mt-3 text-xl font-semibold text-slate-900">
                        {formatProgressPair(selectedTask.currentStep, selectedTask.totalSteps)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Articles</p>
                      <p className="mt-3 text-xl font-semibold text-slate-900">{selectedTask.articleIds.length}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Updated</p>
                      <p className="mt-3 text-sm font-medium text-slate-900">{formatDateTime(selectedTask.updatedAt)}</p>
                    </div>
                  </div>

                  {selectedTask.progressData && (
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">实时进度</h4>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <div>当前步骤: {selectedTask.progressData.currentStep}</div>
                        <div>
                          步骤统计: 完成 {selectedTask.progressData.completedSteps} / 失败 {selectedTask.progressData.failedSteps} / 跳过{" "}
                          {selectedTask.progressData.skippedSteps}
                        </div>
                        <div>
                          文章进度:{" "}
                          {formatProgressPair(
                            selectedTask.progressData.currentArticleIndex + 1,
                            selectedTask.progressData.totalArticles,
                          )}
                        </div>
                        <div>
                          账号进度:{" "}
                          {formatProgressPair(
                            selectedTask.progressData.currentAccountIndex + 1,
                            selectedTask.progressData.totalAccounts,
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {selectedTask.steps && selectedTask.steps.length > 0 && (
                    <section>
                      <h4 className="mb-3 text-sm font-semibold text-slate-900">执行步骤</h4>
                      <div className="space-y-3">
                        {selectedTask.steps.map((step) => {
                          const status = stepStatusConfig[step.status] || stepStatusConfig.pending;
                          const inputData = step.inputData ?? null;
                          const outputData = step.outputData ?? null;
                          const traceStage =
                            step.stepType === "adapter_trace" && inputData && typeof inputData["stage"] === "string"
                              ? String(inputData["stage"])
                              : null;
                          const traceMessage =
                            step.stepType === "adapter_trace"
                              ? (outputData && typeof outputData["message"] === "string"
                                  ? String(outputData["message"])
                                  : inputData && typeof inputData["message"] === "string"
                                    ? String(inputData["message"])
                                    : null)
                              : null;

                          const stepLabel =
                            step.stepType === "adapter_trace"
                              ? traceStage
                                ? `适配器跟踪 · ${traceStage}`
                                : "适配器跟踪"
                              : stepTypeLabels[step.stepType] || step.stepType;

                          return (
                            <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[11px]">
                                      步骤 #{step.stepNumber}
                                    </Badge>
                                    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", status.className)}>
                                      {status.icon}
                                      {status.label}
                                    </span>
                                    <span className="text-sm text-slate-700">{stepLabel}</span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span>
                                      平台 {platformIcons[step.platform]} · {platformLabels[step.platform] || step.platform}
                                    </span>
                                    {step.articleId ? (
                                      <span>文章: {selectedTask.articleTitles?.get(step.articleId) || "未知文章"}</span>
                                    ) : null}
                                    {step.duration != null ? <span>耗时: {formatDuration(step.duration)}</span> : null}
                                  </div>

                                  {traceMessage ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                      {traceMessage}
                                    </div>
                                  ) : null}

                                  {step.errorMessage ? (
                                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                      <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                                      {step.errorMessage}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {inputData && (
                                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <summary className="cursor-pointer text-xs font-medium text-slate-600">输入数据</summary>
                                  <pre className="mt-2 overflow-x-auto text-[11px] text-slate-700">{safeStringify(inputData)}</pre>
                                </details>
                              )}

                              {outputData && (
                                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <summary className="cursor-pointer text-xs font-medium text-slate-600">输出数据</summary>
                                  <pre className="mt-2 overflow-x-auto text-[11px] text-slate-700">{safeStringify(outputData)}</pre>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {selectedTask.errorData && (
                    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        任务错误信息
                      </h4>
                      <pre className="whitespace-pre-wrap text-xs text-red-700">{safeStringify(selectedTask.errorData)}</pre>
                    </section>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
