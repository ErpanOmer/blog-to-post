import { useState, useEffect, useCallback } from "react";
import type { PublishTask, PublishTaskStep } from "../types/publications";
import { getPublishTasks, getPublishTask, cancelPublishTask } from "../api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Send,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PublishStatusPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pending: { label: "等待中", color: "bg-slate-100 text-slate-600", icon: Clock },
  processing: { label: "执行中", color: "bg-blue-100 text-blue-600", icon: Loader2 },
  completed: { label: "已完成", color: "bg-emerald-100 text-emerald-600", icon: CheckCircle2 },
  failed: { label: "失败", color: "bg-red-100 text-red-600", icon: XCircle },
  cancelled: { label: "已取消", color: "bg-amber-100 text-amber-600", icon: X },
};

const stepStatusConfig = {
  pending: { label: "等待", color: "text-slate-400", bgColor: "bg-slate-100" },
  running: { label: "执行中", color: "text-blue-600", bgColor: "bg-blue-100" },
  completed: { label: "完成", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  failed: { label: "失败", color: "text-red-600", bgColor: "bg-red-100" },
  skipped: { label: "跳过", color: "text-amber-600", bgColor: "bg-amber-100" },
};

const stepTypeConfig = {
  validate_account: "验证账号",
  create_draft: "创建草稿",
  publish_article: "发布文章",
  verify_result: "验证结果",
};

export function PublishStatusPanel({ open, onOpenChange }: PublishStatusPanelProps) {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null);
  const [taskSteps, setTaskSteps] = useState<PublishTaskStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    if (!open) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPublishTasks(undefined, 20);
      setTasks(data);
    } catch (err) {
      setError("加载任务列表失败");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [open]);

  // 初始加载
  useEffect(() => {
    if (open) {
      loadTasks();
    }
  }, [open, loadTasks]);

  // 自动刷新（当有待处理或执行中的任务时）
  useEffect(() => {
    if (!open) return;
    
    const hasActiveTasks = tasks.some(t => t.status === "pending" || t.status === "processing");
    if (!hasActiveTasks) return;

    const interval = setInterval(() => {
      loadTasks();
      // 如果正在查看某个任务的详情，也刷新详情
      if (selectedTask) {
        loadTaskSteps(selectedTask.id);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [open, tasks, selectedTask, loadTasks]);

  // 加载任务步骤详情
  const loadTaskSteps = async (taskId: string) => {
    setIsLoadingSteps(true);
    try {
      const data = await getPublishTask(taskId);
      setSelectedTask(data.task);
      setTaskSteps(data.steps);
    } catch (err) {
      console.error("加载任务详情失败", err);
    } finally {
      setIsLoadingSteps(false);
    }
  };

  // 刷新任务列表
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    setIsRefreshing(false);
  };

  // 取消任务
  const handleCancel = async (taskId: string) => {
    try {
      await cancelPublishTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error("取消任务失败", err);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化持续时间
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-brand-500" />
                发布任务状态
              </DialogTitle>
              <DialogDescription>
                查看所有发布任务的执行状态和进度
              </DialogDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
              刷新
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* 任务列表 */}
          <div className="w-1/2 flex flex-col min-h-0">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              任务列表
              <Badge variant="outline" className="text-xs">
                {tasks.length}
              </Badge>
            </h3>
            
            <ScrollArea className="flex-1 pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">暂无发布任务</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const status = statusConfig[task.status];
                    const StatusIcon = status.icon;
                    
                    return (
                      <Card 
                        key={task.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedTask?.id === task.id && "ring-2 ring-brand-500"
                        )}
                        onClick={() => loadTaskSteps(task.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={cn("text-xs", status.color)}>
                                  <StatusIcon className={cn("h-3 w-3 mr-1", task.status === "processing" && "animate-spin")} />
                                  {status.label}
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {task.type === "batch" ? "批量发布" : 
                                   task.type === "scheduled" ? "定时发布" : "单篇发布"}
                                </span>
                              </div>
                              <div className="text-sm text-slate-600">
                                {task.articleIds.length} 篇文章 → {task.accountConfigs.length} 个账号
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {formatTime(task.createdAt)}
                                {task.scheduleTime && (
                                  <span className="ml-2 text-amber-600">
                                    <Calendar className="h-3 w-3 inline mr-1" />
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(task.id);
                                  }}
                                >
                                  <X className="h-4 w-4 text-slate-400" />
                                </Button>
                              )}
                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            </div>
                          </div>
                          
                          {/* 进度条 */}
                          {task.status === "processing" && (
                            <div className="mt-2">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-brand-500 transition-all duration-500"
                                  style={{ width: `${(task.currentStep / task.totalSteps) * 100}%` }}
                                />
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {task.currentStep} / {task.totalSteps} 步骤
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

          {/* 任务详情 */}
          <div className="w-1/2 flex flex-col min-h-0 border-l pl-4">
            {selectedTask ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    执行详情
                  </h3>
                  <Badge className={statusConfig[selectedTask.status].color}>
                    {statusConfig[selectedTask.status].label}
                  </Badge>
                </div>

                {isLoadingSteps ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-3">
                      {taskSteps.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          暂无步骤信息
                        </div>
                      ) : (
                        taskSteps.map((step, index) => {
                          const status = stepStatusConfig[step.status];
                          
                          return (
                            <div 
                              key={step.id}
                              className="relative pl-6 pb-4 last:pb-0"
                            >
                              {/* 连接线 */}
                              {index < taskSteps.length - 1 && (
                                <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-slate-200" />
                              )}
                              
                              {/* 状态点 */}
                              <div className={cn(
                                "absolute left-0 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                step.status === "completed" && "bg-emerald-500 border-emerald-500",
                                step.status === "running" && "bg-blue-500 border-blue-500 animate-pulse",
                                step.status === "failed" && "bg-red-500 border-red-500",
                                step.status === "pending" && "bg-white border-slate-300",
                                step.status === "skipped" && "bg-amber-500 border-amber-500"
                              )}>
                                {step.status === "completed" && (
                                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                )}
                              </div>
                              
                              {/* 步骤内容 */}
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-700">
                                    {stepTypeConfig[step.stepType] || step.stepType}
                                  </span>
                                  <Badge variant="outline" className={cn("text-xs", status.color)}>
                                    {status.label}
                                  </Badge>
                                </div>
                                
                                <div className="text-xs text-slate-500">
                                  {step.platform}
                                  {step.articleId && ` → ${step.articleId.slice(0, 8)}...`}
                                </div>
                                
                                {step.duration && (
                                  <div className="text-xs text-slate-400 mt-1">
                                    耗时: {formatDuration(step.duration)}
                                  </div>
                                )}
                                
                                {step.errorMessage && (
                                  <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">
                                    {step.errorMessage}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* 结果汇总 */}
                    {selectedTask.resultData && (
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">执行结果</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">总文章数:</span>
                            <span className="font-medium">{selectedTask.resultData.totalArticles}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">成功:</span>
                            <span className="font-medium text-emerald-600">
                              {selectedTask.resultData.successfulPublications}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">失败:</span>
                            <span className="font-medium text-red-600">
                              {selectedTask.resultData.failedPublications}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">仅草稿:</span>
                            <span className="font-medium text-amber-600">
                              {selectedTask.resultData.draftOnlyPublications}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Layers className="h-12 w-12 mb-3 text-slate-300" />
                <p className="text-sm">选择左侧任务查看详情</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
