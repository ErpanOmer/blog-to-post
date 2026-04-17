import { useMemo } from "react";
import { CheckCircle2, Circle, ClipboardList, FileText, Loader2, Rocket, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Article } from "@/react-app/types";
import type { PublishTask, PublishTaskStep } from "@/react-app/types/publications";

interface PublishProgressProps {
  task: PublishTask;
  steps: PublishTaskStep[];
  article: Article;
  onClose: () => void;
  onViewDetails: () => void;
}

const platformLabels: Record<string, string> = {
  juejin: "掘金",
  zhihu: "知乎",
  xiaohongshu: "小红书",
  wechat: "公众号",
  csdn: "CSDN",
  cnblogs: "博客园",
};

const stepTypeLabels: Record<string, string> = {
  prepare_task: "准备任务",
  load_article: "加载文章",
  load_account: "加载账号",
  resolve_service: "初始化平台服务",
  validate_account: "校验账号",
  create_draft: "创建草稿",
  publish_article: "正式发布",
  verify_result: "校验结果",
  persist_publication: "记录发布结果",
  update_statistics: "更新统计",
};

function getStepDescription(step: PublishTaskStep): string {
  if (step.status === "running") return "正在执行...";
  if (step.status === "completed") return "已完成";
  if (step.status === "failed") return step.errorMessage || "执行失败";
  if (step.status === "skipped") return "已跳过";
  return "等待执行";
}

export function PublishProgress({ task, steps, article, onClose, onViewDetails }: PublishProgressProps) {
  const workflowSteps = useMemo(
    () => steps.filter((step) => step.stepType !== "adapter_trace").sort((a, b) => a.stepNumber - b.stepNumber),
    [steps],
  );

  const percent = useMemo(() => {
    if (task.totalSteps > 0) {
      const ratio = Math.max(0, Math.min(task.currentStep / task.totalSteps, 1));
      return task.status === "completed" ? 100 : Math.max(6, Math.round(ratio * 100));
    }

    if (workflowSteps.length === 0) return 6;

    const completed = workflowSteps.filter((step) => step.status === "completed").length;
    const ratio = completed / workflowSteps.length;
    return task.status === "completed" ? 100 : Math.max(6, Math.round(ratio * 100));
  }, [task.currentStep, task.status, task.totalSteps, workflowSteps]);

  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isFailed ? (
                <XCircle className="h-5 w-5" />
              ) : (
                <Rocket className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {isCompleted ? "发布完成" : isFailed ? "发布失败" : "正在执行发布任务"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isCompleted
                  ? "任务已经执行完成，可以查看详细日志确认每个平台的结果。"
                  : isFailed
                    ? "任务执行中遇到错误，建议查看详细步骤定位失败环节。"
                    : "系统正在按步骤执行分发流程，你可以留在当前窗口观察进度。"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-200">
                {article.coverImage ? (
                  <img src={article.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <FileText className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{article.title || "未命名文章"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  正文长度 {article.content.length} 字{article.tags?.[0] ? ` · ${article.tags[0]}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>总体进度</span>
            <span>
              {task.currentStep} / {task.totalSteps}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-5">
        <div className="space-y-3">
          {workflowSteps.length > 0 ? (
            workflowSteps.map((step) => {
              const isRunning = step.status === "running";
              const isStepCompleted = step.status === "completed";
              const isStepFailed = step.status === "failed";

              return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-xl border px-4 py-3",
                    isRunning && "border-brand-200 bg-brand-50",
                    isStepCompleted && "border-emerald-200 bg-emerald-50",
                    isStepFailed && "border-red-200 bg-red-50",
                    !isRunning && !isStepCompleted && !isStepFailed && "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-white",
                        isRunning && "border-brand-300 text-brand-600",
                        isStepCompleted && "border-emerald-300 text-emerald-600",
                        isStepFailed && "border-red-300 text-red-600",
                        !isRunning && !isStepCompleted && !isStepFailed && "border-slate-200 text-slate-400",
                      )}
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isStepCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isStepFailed ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {platformLabels[step.platform] || step.platform} · {stepTypeLabels[step.stepType] || step.stepType}
                        </p>
                        <Badge variant="outline" className="text-[11px]">
                          步骤 #{step.stepNumber}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{getStepDescription(step)}</p>
                      {step.errorMessage && <p className="mt-2 text-xs text-red-600">{step.errorMessage}</p>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                正在初始化任务步骤，请稍候...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        {!isCompleted && !isFailed ? (
          <Button variant="outline" className="w-full" onClick={onClose}>
            关闭并后台继续
          </Button>
        ) : (
          <>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              关闭
            </Button>
            <Button className="flex-1" onClick={onViewDetails}>
              查看任务详情
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
