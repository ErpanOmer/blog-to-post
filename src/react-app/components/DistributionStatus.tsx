import { useEffect, useState, useCallback } from "react";
import type { PublishTask, PublishTaskStep } from "../types/publications";
import type { Article } from "../types";
import { getPublishTasks, getPublishTaskSteps, getArticles } from "../api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileText, 
  User, 
  Layers,
  RefreshCw,
  Eye,
  AlertTriangle,
  SkipForward,
  Ban,
  PlayCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskWithDetails extends PublishTask {
  steps?: PublishTaskStep[];
  articleTitles?: Map<string, string>;
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

const stepTypeLabels: Record<string, string> = {
  verify_account: "验证账号",
  create_draft: "创建草稿",
  publish_article: "发布文章",
  verify_result: "验证结果",
};

const stepStatusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "等待中", icon: <Clock className="h-4 w-4" />, color: "text-slate-500" },
  running: { label: "执行中", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-blue-500" },
  completed: { label: "已完成", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-500" },
  failed: { label: "失败", icon: <XCircle className="h-4 w-4" />, color: "text-red-500" },
  skipped: { label: "已跳过", icon: <SkipForward className="h-4 w-4" />, color: "text-amber-500" },
  cancelled: { label: "已取消", icon: <Ban className="h-4 w-4" />, color: "text-slate-400" },
};

const taskStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "等待中", color: "text-slate-600", bgColor: "bg-slate-100" },
  processing: { label: "执行中", color: "text-blue-600", bgColor: "bg-blue-100" },
  completed: { label: "已完成", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  failed: { label: "失败", color: "text-red-600", bgColor: "bg-red-100" },
  cancelled: { label: "已取消", color: "text-slate-500", bgColor: "bg-slate-100" },
};

export function DistributionStatus() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [articles, setArticles] = useState<Map<string, Article>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 加载任务列表
      const taskList = await getPublishTasks();
      
      // 加载所有相关文章
      const articleIds = new Set<string>();
      taskList.forEach(task => {
        task.articleIds.forEach(id => articleIds.add(id));
      });
      
      const allArticles = await getArticles();
      const articleMap = new Map<string, Article>();
      allArticles.forEach(article => {
        if (articleIds.has(article.id)) {
          articleMap.set(article.id, article);
        }
      });
      setArticles(articleMap);

      // 为每个任务加载步骤详情
      const tasksWithDetails = await Promise.all(
        taskList.map(async (task) => {
          const steps = await getPublishTaskSteps(task.id);
          const articleTitles = new Map<string, string>();
          task.articleIds.forEach(id => {
            const article = articleMap.get(id);
            if (article) {
              articleTitles.set(id, article.title || "未命名文章");
            }
          });
          return { ...task, steps, articleTitles };
        })
      );

      setTasks(tasksWithDetails);
    } catch (error) {
      console.error("加载分发状态失败", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // 定时刷新
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredTasks = tasks.filter(task => {
    if (activeFilter === "all") return true;
    if (activeFilter === "running") return task.status === "processing";
    if (activeFilter === "completed") return task.status === "completed";
    if (activeFilter === "failed") return task.status === "failed" || task.status === "cancelled";
    if (activeFilter === "scheduled") return task.status === "pending";
    return true;
  });

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const getTaskSummary = (task: TaskWithDetails) => {
    const platforms = new Set<string>();
    const accounts = new Set<string>();
    task.accountConfigs?.forEach(config => {
      platforms.add(config.platform);
      accounts.add(config.accountId);
    });
    return { platforms: platforms.size, accounts: accounts.size };
  };

  const getStepErrorSummary = (steps: PublishTaskStep[]) => {
    const failed = steps.filter(s => s.status === "failed").length;
    const skipped = steps.filter(s => s.status === "skipped").length;
    return { failed, skipped };
  };

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">总任务数</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <Layers className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">执行中</p>
                <p className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === "processing").length}
                </p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已完成</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {tasks.filter(t => t.status === "completed").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">失败/取消</p>
                <p className="text-2xl font-bold text-red-600">
                  {tasks.filter(t => t.status === "failed" || t.status === "cancelled").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-500" />
                分发任务列表
              </CardTitle>
              <CardDescription>查看所有文章分发任务的执行状态和详情</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选标签 */}
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="running" className="gap-1">
                <PlayCircle className="h-3 w-3" />
                执行中
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-1">
                <Clock className="h-3 w-3" />
                待执行
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                已完成
              </TabsTrigger>
              <TabsTrigger value="failed" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                失败
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 任务表格 */}
          <ScrollArea className="h-[500px]">
            {isLoading && tasks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无任务</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const summary = getTaskSummary(task);
                  const errorSummary = task.steps ? getStepErrorSummary(task.steps) : { failed: 0, skipped: 0 };
                  const statusConfig = taskStatusConfig[task.status] || taskStatusConfig.pending;

                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* 任务头部信息 */}
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={cn(statusConfig.bgColor, statusConfig.color, "border-0")}>
                              {statusConfig.label}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {formatDateTime(task.createdAt)}
                            </span>
                            {task.scheduleTime && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                定时: {formatDateTime(task.scheduleTime)}
                              </Badge>
                            )}
                          </div>

                          {/* 任务统计 */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4 text-slate-400" />
                              <span>{task.articleIds.length} 篇文章</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>{summary.accounts} 个账号</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Layers className="h-4 w-4 text-slate-400" />
                              <span>{summary.platforms} 个平台</span>
                            </div>
                            {task.steps && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                                <span>
                                  {task.steps.filter(s => s.status === "completed").length}/{task.steps.length} 步骤
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 文章标题预览 */}
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span>文章:</span>
                            <span className="truncate">
                              {Array.from(task.articleTitles?.values() || []).slice(0, 2).join(", ")}
                              {(task.articleTitles?.size || 0) > 2 && ` 等${task.articleTitles?.size}篇`}
                            </span>
                          </div>

                          {/* 错误提示 */}
                          {(errorSummary.failed > 0 || errorSummary.skipped > 0) && (
                            <div className="mt-2 flex items-center gap-2">
                              {errorSummary.failed > 0 && (
                                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {errorSummary.failed} 个步骤失败
                                </Badge>
                              )}
                              {errorSummary.skipped > 0 && (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                                  <SkipForward className="h-3 w-3 mr-1" />
                                  {errorSummary.skipped} 个步骤跳过
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 右侧操作 */}
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-5 w-5 text-slate-300" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 任务详情弹窗 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-brand-500" />
                  任务详情
                </DialogTitle>
                <DialogDescription>
                  创建时间: {formatDateTime(selectedTask.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  {/* 任务概览 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">任务状态</p>
                      <Badge className={cn(
                        taskStatusConfig[selectedTask.status]?.bgColor,
                        taskStatusConfig[selectedTask.status]?.color,
                        "border-0"
                      )}>
                        {taskStatusConfig[selectedTask.status]?.label || selectedTask.status}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">进度</p>
                      <p className="text-lg font-semibold">
                        {selectedTask.currentStep} / {selectedTask.totalSteps}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">文章数</p>
                      <p className="text-lg font-semibold">{selectedTask.articleIds.length}</p>
                    </div>
                  </div>

                  {/* 参与的文章 */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      参与的文章 ({selectedTask.articleIds.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedTask.articleIds.map((articleId, index) => {
                        const title = selectedTask.articleTitles?.get(articleId) || "未知文章";
                        return (
                          <div key={articleId} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                            <span className="text-xs text-slate-400 w-6">{index + 1}</span>
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-sm truncate">{title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 参与的账号和平台 */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      发布的平台和账号
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedTask.accountConfigs?.map((config, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                          <span className="text-lg">{platformIcons[config.platform]}</span>
                          <span className="text-sm">{platformLabels[config.platform] || config.platform}</span>
                          {config.draftOnly && (
                            <Badge variant="outline" className="text-xs">草稿</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 执行步骤详情 */}
                  {selectedTask.steps && selectedTask.steps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        执行步骤详情
                      </h4>
                      <div className="space-y-2">
                        {selectedTask.steps.map((step, index) => {
                          const statusConfig = stepStatusConfig[step.status] || stepStatusConfig.pending;
                          return (
                            <div
                              key={step.id}
                              className={cn(
                                "p-4 rounded-xl border",
                                step.status === "failed" && "border-red-200 bg-red-50",
                                step.status === "completed" && "border-emerald-200 bg-emerald-50",
                                step.status === "skipped" && "border-amber-200 bg-amber-50",
                                step.status === "running" && "border-blue-200 bg-blue-50",
                                !["failed", "completed", "skipped", "running"].includes(step.status) && "border-slate-200 bg-white"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xs text-slate-400">步骤 {step.stepNumber}</span>
                                    <span className={cn("flex items-center gap-1 text-sm font-medium", statusConfig.color)}>
                                      {statusConfig.icon}
                                      {statusConfig.label}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {stepTypeLabels[step.stepType] || step.stepType}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                                    <span className="flex items-center gap-1">
                                      {platformIcons[step.platform]}
                                      {platformLabels[step.platform] || step.platform}
                                    </span>
                                    {step.articleId && (
                                      <span className="truncate">
                                        文章: {selectedTask.articleTitles?.get(step.articleId) || "未知"}
                                      </span>
                                    )}
                                  </div>

                                  {step.duration && (
                                    <p className="text-xs text-slate-400">
                                      耗时: {formatDuration(step.duration)}
                                    </p>
                                  )}

                                  {step.errorMessage && (
                                    <div className="mt-2 p-2 rounded bg-red-100 text-red-700 text-xs">
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      {step.errorMessage}
                                    </div>
                                  )}

                                  {step.status === "skipped" && (
                                    <div className="mt-2 p-2 rounded bg-amber-100 text-amber-700 text-xs">
                                      <SkipForward className="h-3 w-3 inline mr-1" />
                                      该步骤已被跳过
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 错误信息 */}
                  {selectedTask.errorData && (
                    <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        错误信息
                      </h4>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap">
                        {JSON.stringify(selectedTask.errorData, null, 2)}
                      </pre>
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
