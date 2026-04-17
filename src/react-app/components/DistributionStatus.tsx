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
  pending: { label: "待执行", icon: <Clock className="h-3.5 w-3.5" />, className: "text-slate-400" },
  running: { label: "执行中", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-brand-500" },
  completed: { label: "已完成", icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "text-emerald-500" },
  failed: { label: "失败", icon: <XCircle className="h-3.5 w-3.5" />, className: "text-red-500" },
  skipped: { label: "已跳过", icon: <SkipForward className="h-3.5 w-3.5" />, className: "text-amber-500" },
  cancelled: { label: "已取消", icon: <XCircle className="h-3.5 w-3.5" />, className: "text-slate-400" },
};

const taskStatusConfig: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: "待执行", badgeClass: "border-slate-200 bg-slate-50 text-slate-600" },
  processing: { label: "执行中", badgeClass: "border-blue-200/60 bg-blue-50 text-blue-600" },
  completed: { label: "已完成", badgeClass: "border-emerald-200/60 bg-emerald-50 text-emerald-600" },
  failed: { label: "失败", badgeClass: "border-red-200/60 bg-red-50 text-red-600" },
  cancelled: { label: "已取消", badgeClass: "border-slate-200 bg-slate-50 text-slate-500" },
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

  const summaryCards = [
    { label: "Tasks", value: summary.total, icon: Layers, color: "text-slate-400" },
    { label: "Running", value: summary.running, icon: PlayCircle, color: "text-brand-400" },
    { label: "Completed", value: summary.completed, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Failed", value: summary.failed, icon: AlertTriangle, color: "text-red-400" },
  ];

  return (
    <div className="space-y-4 page-enter">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
                  </div>
                  <Icon className={cn("h-5 w-5", card.color)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Task list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-brand-500" />
                分发任务看板
              </CardTitle>
              <CardDescription className="mt-1">查看任务队列、执行进度和步骤日志</CardDescription>
            </div>

            <Button variant="outline" size="xs" onClick={() => void loadData()} disabled={isLoading} className="gap-1.5 self-start">
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-3">
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="running">执行中</TabsTrigger>
              <TabsTrigger value="scheduled">待执行</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
              <TabsTrigger value="failed">失败</TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            {isLoading && filteredTasks.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载任务...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center text-[13px] text-slate-400">
                <Layers className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                当前筛选下暂无任务
              </div>
            ) : (
              <div className="space-y-2">
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
                      className="w-full rounded-lg border border-slate-100 bg-white p-3.5 text-left transition-all duration-200 hover:border-slate-200 hover:bg-slate-50/50 hover:shadow-sm"
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <Badge className={cn("border text-[10px]", status.badgeClass)}>{status.label}</Badge>
                            <span className="text-[11px] text-slate-400">{formatDateTime(task.createdAt)}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5 text-slate-300" />
                              {task.articleIds.length}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-slate-300" />
                              {accountCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5 text-slate-300" />
                              {platformCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-slate-300" />
                              {formatProgressPair(done, task.totalSteps || 0)}
                            </span>
                          </div>

                          <div className="mt-2.5">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span>{task.progressData?.currentStep || "等待执行"}</span>
                              <span className="tabular-nums">{progress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
          {selectedTask && (
            <>
              <DialogHeader className="border-b border-slate-100 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-brand-500" />
                  任务详情
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(selectedTask.createdAt)} · {selectedTask.id}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 px-5 py-4 overflow-y-scroll">
                <div className="space-y-4">
                  {/* Detail stat cards */}
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Status</p>
                      <Badge className={cn("mt-2 border", taskStatusConfig[selectedTask.status]?.badgeClass)}>
                        {taskStatusConfig[selectedTask.status]?.label || selectedTask.status}
                      </Badge>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Progress</p>
                      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                        {formatProgressPair(selectedTask.currentStep, selectedTask.totalSteps)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Articles</p>
                      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">{selectedTask.articleIds.length}</p>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Updated</p>
                      <p className="mt-2 text-[13px] font-medium text-slate-700">{formatDateTime(selectedTask.updatedAt)}</p>
                    </div>
                  </div>

                  {/* Progress data */}
                  {selectedTask.progressData && (
                    <div className="rounded-lg border border-slate-100 bg-white p-3.5">
                      <h4 className="text-[13px] font-semibold text-slate-800">实时进度</h4>
                      <div className="mt-2.5 grid gap-1.5 text-[12px] text-slate-500 md:grid-cols-2">
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
                    </div>
                  )}

                  {/* Steps */}
                  {selectedTask.steps && selectedTask.steps.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-[13px] font-semibold text-slate-800">执行步骤</h4>
                      <div className="space-y-2">
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
                            <div key={step.id} className="rounded-lg border border-slate-100 bg-white p-3.5">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px]">
                                      #{step.stepNumber}
                                    </Badge>
                                    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", status.className)}>
                                      {status.icon}
                                      {status.label}
                                    </span>
                                    <span className="text-[12px] text-slate-600">{stepLabel}</span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                    <span>
                                      {platformIcons[step.platform]} {platformLabels[step.platform] || step.platform}
                                    </span>
                                    {step.articleId ? (
                                      <span>文章: {selectedTask.articleTitles?.get(step.articleId) || "未知文章"}</span>
                                    ) : null}
                                    {step.duration != null ? <span>耗时: {formatDuration(step.duration)}</span> : null}
                                  </div>

                                  {traceMessage ? (
                                    <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/50 px-2.5 py-1.5 text-[11px] text-slate-600">
                                      {traceMessage}
                                    </div>
                                  ) : null}

                                  {step.errorMessage ? (
                                    <div className="mt-2 rounded-md border border-red-100 bg-red-50/50 px-2.5 py-1.5 text-[11px] text-red-600">
                                      <AlertCircle className="mr-1 inline h-3 w-3" />
                                      {step.errorMessage}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {inputData && (
                                <details className="mt-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                                  <summary className="cursor-pointer text-[11px] font-medium text-slate-500">输入数据</summary>
                                  <pre className="mt-1.5 overflow-x-auto text-[10px] text-slate-600">{safeStringify(inputData)}</pre>
                                </details>
                              )}

                              {outputData && (
                                <details className="mt-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                                  <summary className="cursor-pointer text-[11px] font-medium text-slate-500">输出数据</summary>
                                  <pre className="mt-1.5 overflow-x-auto text-[10px] text-slate-600">{safeStringify(outputData)}</pre>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTask.errorData && (
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-3.5">
                      <h4 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        任务错误信息
                      </h4>
                      <pre className="whitespace-pre-wrap text-[11px] text-red-600">{safeStringify(selectedTask.errorData)}</pre>
                    </div>
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
