import { useState, useEffect } from "react";
import type { Article } from "@/react-app/types";
import type { PlatformAccount } from "@/react-app/api";
import type { AccountConfig } from "@/react-app/types/publications";
import {
  getPlatformAccounts,
  getPublishTask,
  getPublishTaskSteps,
} from "@/react-app/api";
import type { PublishTask, PublishTaskStep } from "@/react-app/types/publications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  User,
  Layers,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Hash,
  Rocket,
  XCircle
} from "lucide-react";
import { PublishProgress } from "./PublishProgress";
import { cn } from "@/lib/utils";

interface PublishDialogProps {
  articles: Article[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublishConfirm?: (accountConfigs: AccountConfig[], scheduleTime: number | null) => Promise<string | null>;
  onQuickPublishConfirm?: (accountConfigs: AccountConfig[], scheduleTime: number | null) => Promise<string | null>;
  isQuickPublish?: boolean;
  onTaskCompleted?: (taskId: string) => void;
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

export function PublishDialog({
  articles,
  open,
  onOpenChange,
  onPublishConfirm,
  onQuickPublishConfirm,
  isQuickPublish = false,
  onTaskCompleted,
}: PublishDialogProps) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [accountConfigs, setAccountConfigs] = useState<Map<string, AccountConfig>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [showArticles, setShowArticles] = useState(false);

  // Progress State
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState<PublishTask | null>(null);
  const [taskSteps, setTaskSteps] = useState<PublishTaskStep[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // 加载平台账号
  useEffect(() => {
    if (open) {
      loadAccounts();
      setShowArticles(false);
      // 重置状态
      setError(null);
      setSuccess(null);
      setIsSubmitting(false);
      setIsSubmitting(false);
      setCurrentTaskId(null);
      setTaskProgress(null);
      setTaskSteps([]);
      setIsPolling(false);
    }
  }, [open]);

  // Polling Effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPolling && currentTaskId) {
      const fetchProgress = async () => {
        try {
          const [taskData, stepsData] = await Promise.all([
            getPublishTask(currentTaskId).then(res => res.task),
            getPublishTaskSteps(currentTaskId)
          ]);

          setTaskProgress(taskData);
          setTaskSteps(stepsData);

          if (["completed", "failed", "cancelled"].includes(taskData.status)) {
            setIsPolling(false);
            setSuccess(taskData.status === "completed" ? "发布任务已完成！" : null);
            if (taskData.status === "failed") {
              setError("发布任务部分或全部失败，请查看详情");
            }
          }
        } catch (err) {
          console.error("Poll error", err);
        }
      };

      // Initial fetch
      fetchProgress();

      // Poll every 3 seconds
      intervalId = setInterval(fetchProgress, 3000);
    }

    return () => clearInterval(intervalId);
  }, [isPolling, currentTaskId]);

  const loadAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPlatformAccounts();
      // 只显示已验证且激活的账号
      const activeAccounts = data.filter(a => a.isActive && a.isVerified);
      setAccounts(activeAccounts);

      // 默认全选
      const allAccountIds = new Set(activeAccounts.map(a => a.id));
      setSelectedAccounts(allAccountIds);

      // 默认开启只发草稿
      const configs = new Map<string, AccountConfig>();
      activeAccounts.forEach(account => {
        configs.set(account.id, {
          accountId: account.id,
          platform: account.platform,
          draftOnly: true, // 默认开启只发草稿
        });
      });
      setAccountConfigs(configs);
    } catch (err) {
      setError("加载账号列表失败");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 按平台分组账号
  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, PlatformAccount[]>);

  // 切换账号选择
  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // 全选/取消全选某个平台的账号
  const togglePlatform = (platform: string, checked: boolean) => {
    const platformAccounts = accountsByPlatform[platform] || [];
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      platformAccounts.forEach(account => {
        if (checked) {
          next.add(account.id);
        } else {
          next.delete(account.id);
        }
      });
      return next;
    });
  };

  // 切换只发草稿设置
  const toggleDraftOnly = (accountId: string, draftOnly: boolean) => {
    setAccountConfigs(prev => {
      const next = new Map(prev);
      const config = next.get(accountId);
      if (config) {
        next.set(accountId, { ...config, draftOnly });
      }
      return next;
    });
  };

  // 全选所有账号
  const selectAll = () => {
    setSelectedAccounts(new Set(accounts.map(a => a.id)));
  };

  // 取消全选
  const deselectAll = () => {
    setSelectedAccounts(new Set());
  };

  // 处理发布 - BUG FIX: 调用父组件的确认回调
  const handlePublish = async () => {
    if (selectedAccounts.size === 0) {
      setError("请至少选择一个发布账号");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const configs: AccountConfig[] = [];
      selectedAccounts.forEach(accountId => {
        const config = accountConfigs.get(accountId);
        if (config) {
          configs.push(config);
        }
      });

      let scheduleTimeMs: number | null = null;
      if (publishMode === "scheduled" && scheduleDate && scheduleTime) {
        const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        scheduleTimeMs = dateTime.getTime();

        if (scheduleTimeMs <= Date.now()) {
          setError("定时时间必须晚于当前时间");
          setIsSubmitting(false);
          return;
        }
      }

      // BUG FIX: 调用父组件的确认回调，而不是直接创建任务
      let taskId: string | null = null;
      if (isQuickPublish && onQuickPublishConfirm) {
        taskId = await onQuickPublishConfirm(configs, scheduleTimeMs);
      } else if (onPublishConfirm) {
        taskId = await onPublishConfirm(configs, scheduleTimeMs);
      }

      if (taskId) {
        setCurrentTaskId(taskId);
        setIsPolling(true);
      } else {
        // Fallback if no taskId returned (shouldn't happen with new logic)
        setSuccess("发布任务创建成功！");
        setTimeout(() => onOpenChange(false), 1500);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败");
      setIsSubmitting(false); // Only stop submitting on error in catch block, otherwise keep loading for progress view
    }
  };

  const handleViewDetails = () => {
    if (currentTaskId && onTaskCompleted) {
      onTaskCompleted(currentTaskId);
      onOpenChange(false);
    }
  };

  const isSingleArticle = articles.length === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                {isQuickPublish ? (
                  <Rocket className="h-5 w-5 text-brand-500" />
                ) : (
                  <Clock className="h-5 w-5 text-brand-500" />
                )}
                {isSingleArticle ? "发布文章" : `批量发布 (${articles.length} 篇)`}
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {isSingleArticle
                  ? "选择要发布的平台和账号"
                  : `将 ${articles.length} 篇文章发布到选定的平台和账号`}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="text-xs px-3 py-1">
              {articles.length} 篇文章
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 文章列表预览（可折叠） */}
          <Card className="overflow-hidden border-slate-200">
            <button
              onClick={() => setShowArticles(!showArticles)}
              className="w-full px-4 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">待发布文章</span>
                <Badge variant="outline" className="text-xs">
                  {articles.length} 篇
                </Badge>
              </div>
              {showArticles ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showArticles && (
              <CardContent className="p-0">
                <ScrollArea className="max-h-[200px]">
                  <div className="divide-y divide-slate-100">
                    {articles.map((article, index) => (
                      <div key={article.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50">
                        <span className="text-xs text-slate-400 w-6">{index + 1}</span>
                        {article.coverImage ? (
                          <img
                            src={article.coverImage}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {article.title || "未命名文章"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span>{article.status}</span>
                            {article.tags && article.tags.length > 0 && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  {article.tags.slice(0, 2).join(", ")}
                                  {article.tags.length > 2 && ` +${article.tags.length - 2}`}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>

          {/* 发布模式选择 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPublishMode("immediate")}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                publishMode === "immediate"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <Rocket className="h-5 w-5" />
              <div className="text-left">
                <div className="text-sm font-semibold">立即发布</div>
                <div className="text-xs opacity-70 mt-0.5">马上执行发布任务</div>
              </div>
            </button>
            <button
              onClick={() => setPublishMode("scheduled")}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                publishMode === "scheduled"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <Clock className="h-5 w-5" />
              <div className="text-left">
                <div className="text-sm font-semibold">定时发布</div>
                <div className="text-xs opacity-70 mt-0.5">预约未来时间发布</div>
              </div>
            </button>
          </div>

          {/* 定时设置 */}
          {publishMode === "scheduled" && (
            <div className="flex gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <Calendar className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <Label className="text-sm font-semibold text-amber-900">选择发布时间</Label>
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-36 px-4 py-2.5 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 平台账号选择 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-slate-500" />
                <Label className="text-sm font-semibold">选择发布平台</Label>
                <Badge variant="outline" className="text-xs">
                  已选 {selectedAccounts.size} 个账号
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-8 text-xs">
                  全选
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="h-8 text-xs">
                  取消全选
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">加载账号...</span>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <User className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">暂无可用账号</p>
                  <p className="text-xs text-slate-400 mt-1">请先添加并验证平台账号</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => {
                    const platformSelected = platformAccounts.every(a => selectedAccounts.has(a.id));
                    const platformPartial = platformAccounts.some(a => selectedAccounts.has(a.id)) && !platformSelected;

                    return (
                      <div key={platform} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* 平台标题 */}
                        <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                          <Checkbox
                            checked={platformSelected}
                            onCheckedChange={(checked) => togglePlatform(platform, checked as boolean)}
                            className={cn(platformPartial && "bg-brand-500 border-brand-500")}
                          />
                          <span className="text-lg">{platformIcons[platform]}</span>
                          <span className="font-semibold text-sm">{platformLabels[platform] || platform}</span>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {platformAccounts.length} 个账号
                          </Badge>
                        </div>

                        {/* 账号列表 */}
                        <div className="divide-y divide-slate-100">
                          {platformAccounts.map(account => {
                            const config = accountConfigs.get(account.id);
                            const isSelected = selectedAccounts.has(account.id);

                            return (
                              <div
                                key={account.id}
                                className={cn(
                                  "px-4 py-3.5 flex items-center gap-3 transition-colors",
                                  isSelected ? "bg-white" : "bg-slate-50/50"
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAccount(account.id)}
                                />

                                {/* 账号信息 */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {account.avatar ? (
                                      <img
                                        src={account.avatar}
                                        alt={account.userName || ""}
                                        className="w-7 h-7 rounded-full"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                                        {account.userName?.[0] || "?"}
                                      </div>
                                    )}
                                    <span className="text-sm font-medium truncate">
                                      {account.userName || "未命名账号"}
                                    </span>
                                    {account.description && (
                                      <span className="text-xs text-slate-400 truncate">
                                        ({account.description})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 只发草稿开关 */}
                                <div className="flex items-center gap-2.5">
                                  <Switch
                                    checked={config?.draftOnly ?? true}
                                    onCheckedChange={(checked) => toggleDraftOnly(account.id, checked)}
                                    disabled={!isSelected}
                                    className="data-[state=checked]:bg-amber-500"
                                  />
                                  <span className={cn(
                                    "text-xs whitespace-nowrap",
                                    isSelected ? "text-slate-600" : "text-slate-400"
                                  )}>
                                    只发草稿
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 错误和成功提示 */}
          {error && (
            <div className="flex items-center gap-2.5 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {/* Progress UI Overlay or Replacement */}
        {/* Progress UI Overlay (New Premium Design) */}
        {currentTaskId && taskProgress && (
          <div className="absolute inset-0 z-50 bg-white">
            <PublishProgress
              task={taskProgress}
              steps={taskSteps}
              article={articles[0]} // Using first article for preview for now
              onClose={() => onOpenChange(false)}
              onViewDetails={handleViewDetails}
            />
          </div>
        )}

        {/* 底部按钮 (Original Footer) */}
        <DialogFooter className="gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="px-6">
            取消
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isSubmitting || selectedAccounts.size === 0 || isLoading}
            className="bg-brand-600 hover:bg-brand-700 px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                发布中...
              </>
            ) : publishMode === "scheduled" ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                定时发布
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                立即发布 {articles.length > 1 && `(${articles.length}篇)`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
