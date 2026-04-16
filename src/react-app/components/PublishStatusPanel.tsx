import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublishTask, PublishTaskStep } from "@/react-app/types/publications";
import { cancelPublishTask, getPublishTask, getPublishTasks } from "@/react-app/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  X,
  XCircle,
} from "lucide-react";

interface PublishStatusPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const taskStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-slate-100 text-slate-600", icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-600", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-600", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-600", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-amber-100 text-amber-600", icon: <X className="h-3 w-3" /> },
};

const stepStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-slate-500" },
  running: { label: "Running", color: "text-blue-600" },
  completed: { label: "Completed", color: "text-emerald-600" },
  failed: { label: "Failed", color: "text-red-600" },
  skipped: { label: "Skipped", color: "text-amber-600" },
};

const stepTypeConfig: Record<string, string> = {
  prepare_task: "Prepare context",
  load_article: "Load article",
  load_account: "Load account",
  resolve_service: "Resolve service",
  validate_account: "Validate account",
  create_draft: "Create draft",
  publish_article: "Publish article",
  verify_result: "Verify result",
  persist_publication: "Persist publication",
  update_statistics: "Update statistics",
  adapter_trace: "Adapter trace",
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatProgressPair(current: number, total: number): string {
  if (total <= 0) return "0 / 0";
  const normalized = Math.max(0, Math.min(current, total));
  return `${normalized} / ${total}`;
}

function getProgressRatio(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(current / total, 1));
}

export function PublishStatusPanel({ open, onOpenChange }: PublishStatusPanelProps) {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PublishTaskStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null),
    [selectedTaskId, tasks],
  );

  const loadTasks = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    try {
      const next = await getPublishTasks(undefined, 20);
      setTasks(next);
    } catch (err) {
      console.error("Failed to load tasks", err);
      setError("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [open]);

  const loadTaskDetail = useCallback(async (taskId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getPublishTask(taskId);
      setSelectedTaskId(taskId);
      setSteps(detail.steps);
      setTasks((prev) => prev.map((task) => (task.id === detail.task.id ? detail.task : task)));
    } catch (err) {
      console.error("Failed to load task detail", err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadTasks();
  }, [loadTasks, open]);

  useEffect(() => {
    if (!open) return;
    const hasActiveTasks = tasks.some((task) => task.status === "pending" || task.status === "processing");
    if (!hasActiveTasks) return;
    const timer = setInterval(() => {
      void loadTasks();
      if (selectedTaskId) void loadTaskDetail(selectedTaskId);
    }, 3000);
    return () => clearInterval(timer);
  }, [loadTaskDetail, loadTasks, open, selectedTaskId, tasks]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    if (selectedTaskId) await loadTaskDetail(selectedTaskId);
    setIsRefreshing(false);
  };

  const handleCancel = async (taskId: string) => {
    try {
      await cancelPublishTask(taskId);
      await loadTasks();
      if (selectedTaskId === taskId) await loadTaskDetail(taskId);
    } catch (err) {
      console.error("Failed to cancel task", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-brand-500" />
                Publish Task Status
              </DialogTitle>
              <DialogDescription>Track execution progress and inspect step details</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-1 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex w-1/2 min-h-0 flex-col">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Layers className="h-4 w-4" />
              Tasks
              <Badge variant="outline" className="text-xs">{tasks.length}</Badge>
            </h3>

            <ScrollArea className="flex-1 pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <Clock className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-sm">No tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const status = taskStatusConfig[task.status] || taskStatusConfig.pending;
                    return (
                      <Card
                        key={task.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedTaskId === task.id && "ring-2 ring-brand-500",
                        )}
                        onClick={() => void loadTaskDetail(task.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <Badge className={cn("text-xs", status.color)}>
                                  <span className="mr-1">{status.icon}</span>
                                  {status.label}
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {task.type === "batch" ? "Batch" : task.type === "scheduled" ? "Scheduled" : "Single"}
                                </span>
                              </div>
                              <div className="text-sm text-slate-600">
                                {`${task.articleIds.length} articles -> ${task.accountConfigs.length} accounts`}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatTime(task.createdAt)}
                                {task.scheduleTime && (
                                  <span className="ml-2 text-amber-600">
                                    <Calendar className="mr-1 inline h-3 w-3" />
                                    {formatTime(task.scheduleTime)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {task.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleCancel(task.id);
                                  }}
                                >
                                  <X className="h-4 w-4 text-slate-400" />
                                </Button>
                              )}
                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            </div>
                          </div>

                          {task.status === "processing" && (
                            <div className="mt-2">
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full bg-brand-500 transition-all duration-500"
                                  style={{ width: `${getProgressRatio(task.currentStep, task.totalSteps) * 100}%` }}
                                />
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatProgressPair(task.currentStep, task.totalSteps)} steps
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex w-1/2 min-h-0 flex-col border-l pl-4">
            {selectedTask ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <RotateCcw className="h-4 w-4" />
                    Details
                  </h3>
                  <Badge className={taskStatusConfig[selectedTask.status]?.color || taskStatusConfig.pending.color}>
                    {taskStatusConfig[selectedTask.status]?.label || selectedTask.status}
                  </Badge>
                </div>

                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-3">
                      {steps.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-400">No step records</div>
                      ) : (
                        steps.map((step, index) => {
                          const status = stepStatusConfig[step.status] || stepStatusConfig.pending;
                          const inputData = step.inputData ?? null;
                          const outputData = step.outputData ?? null;
                          const traceStage =
                            step.stepType === "adapter_trace" && inputData && typeof inputData["stage"] === "string"
                              ? String(inputData["stage"])
                              : null;
                          const traceMessage =
                            step.stepType === "adapter_trace"
                              ? (
                                (outputData && typeof outputData["message"] === "string" ? String(outputData["message"]) : null) ??
                                (inputData && typeof inputData["message"] === "string" ? String(inputData["message"]) : null)
                              )
                              : null;
                          const stepLabel =
                            step.stepType === "adapter_trace"
                              ? (traceStage ? `Adapter Trace - ${traceStage}` : "Adapter Trace")
                              : (stepTypeConfig[step.stepType] || step.stepType);

                          return (
                            <div key={step.id} className="relative pb-4 pl-6 last:pb-0">
                              {index < steps.length - 1 && (
                                <div className="absolute bottom-0 left-2 top-6 w-0.5 bg-slate-200" />
                              )}
                              <div
                                className={cn(
                                  "absolute left-0 top-1 h-4 w-4 rounded-full border-2",
                                  step.status === "completed" && "border-emerald-500 bg-emerald-500",
                                  step.status === "running" && "animate-pulse border-blue-500 bg-blue-500",
                                  step.status === "failed" && "border-red-500 bg-red-500",
                                  step.status === "pending" && "border-slate-300 bg-white",
                                  step.status === "skipped" && "border-amber-500 bg-amber-500",
                                )}
                              />
                              <div className="rounded-lg bg-slate-50 p-3">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">{stepLabel}</span>
                                  <Badge variant="outline" className={cn("text-xs", status.color)}>
                                    {status.label}
                                  </Badge>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {step.platform}
                                  {step.articleId && ` -> ${step.articleId.slice(0, 8)}...`}
                                </div>
                                {step.duration != null && (
                                  <div className="mt-1 text-xs text-slate-400">Duration: {formatDuration(step.duration)}</div>
                                )}
                                {traceMessage && (
                                  <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                                    {traceMessage}
                                  </div>
                                )}
                                {step.errorMessage && (
                                  <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{step.errorMessage}</div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
                <Layers className="mb-3 h-12 w-12 text-slate-300" />
                <p className="text-sm">Select a task to inspect</p>
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
