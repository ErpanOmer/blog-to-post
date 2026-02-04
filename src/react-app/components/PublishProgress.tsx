import { useEffect, useState } from "react";
import {
    CheckCircle2,
    Circle,
    Clock,
    Loader2,
    XCircle,
    ChevronRight,
    ExternalLink,
    Sparkles,
    LayoutTemplate
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { PublishTask, PublishTaskStep } from "@/react-app/types/publications";
import type { Article } from "@/react-app/types";

// Since we don't have framer-motion installed, we'll use a simple CSS animation wrapper
// or just standard Tailwind animate classes.

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
};

export function PublishProgress({
    task,
    steps,
    article,
    onClose,
    onViewDetails
}: PublishProgressProps) {
    const [percent, setPercent] = useState(0);

    // Calculate progress percentage
    useEffect(() => {
        if (steps.length === 0) {
            setPercent(5);
            return;
        }
        const completed = steps.filter(s => s.status === 'completed').length;
        const total = steps.length;
        // If task is completed, force 100%
        if (task.status === 'completed') {
            setPercent(100);
        } else {
            setPercent(Math.max(5, Math.round((completed / total) * 100)));
        }
    }, [steps, task.status]);

    const isCompleted = task.status === 'completed';
    const isFailed = task.status === 'failed';

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none" />

            {/* Header Section */}
            <div className="relative z-10 px-8 pt-8 pb-6 text-center border-b border-slate-50/50">
                <div className="inline-flex items-center justify-center p-3 bg-brand-50 rounded-2xl mb-4 shadow-sm ring-1 ring-brand-100">
                    <Sparkles className={cn("w-6 h-6 text-brand-600", !isCompleted && !isFailed && "animate-pulse")} />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
                    {isCompleted ? "发布完成" : isFailed ? "发布遇到问题" : "正在分发文章"}
                </h2>

                <p className="text-slate-500 text-sm max-w-md mx-auto">
                    {isCompleted
                        ? "您的文章已成功推送到所有选定平台。"
                        : isFailed
                            ? "部分平台发布失败，请检查详情。"
                            : "AI 正在自动处理排版与分发，请稍候..."}
                </p>

                {/* Article Preview Card (Mini) */}
                <div className="mt-6 mx-auto max-w-lg bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-4 text-left">
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-100 overflow-hidden relative">
                        {article.coverImage ? (
                            <img src={article.coverImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                                <LayoutTemplate className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{article.title || "无标题文章"}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm font-normal text-slate-500">
                                {article.tags?.[0] || "Blog"}
                            </Badge>
                            <span className="text-xs text-slate-400">
                                {article.content.length} 字
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar (Sticky) */}
            <div className="px-8 py-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                    <span>总体进度</span>
                    <span>{percent}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-slate-900 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {/* Timeline Scroll Area */}
            <ScrollArea className="flex-1 px-8 py-4">
                <div className="relative pl-4 space-y-6 pb-8">
                    {/* Vertical Line */}
                    <div className="absolute top-2 left-[19px] bottom-6 w-0.5 bg-slate-100" />

                    {steps.map((step, index) => {
                        const isRunning = step.status === 'running';
                        const isStepCompleted = step.status === 'completed';
                        const isStepFailed = step.status === 'failed';

                        return (
                            <div key={step.id} className="relative z-10 flex gap-4 group">
                                {/* Icon Bubble */}
                                <div className={cn(
                                    "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 shadow-sm bg-white shrink-0",
                                    isRunning ? "border-brand-500 text-brand-600 scale-110 shadow-brand-100 ring-4 ring-brand-50" :
                                        isStepCompleted ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                                            isStepFailed ? "border-red-500 text-red-600 bg-red-50" :
                                                "border-slate-200 text-slate-300"
                                )}>
                                    {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                        isStepCompleted ? <CheckCircle2 className="w-5 h-5" /> :
                                            isStepFailed ? <XCircle className="w-5 h-5" /> :
                                                <Circle className="w-4 h-4" />
                                    }
                                </div>

                                {/* Content Content */}
                                <div className={cn(
                                    "flex-1 pt-1 transition-opacity duration-300",
                                    step.status === 'pending' ? "opacity-40" : "opacity-100"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <h3 className={cn(
                                            "text-sm font-medium",
                                            isRunning ? "text-brand-700" : "text-slate-900"
                                        )}>
                                            {platformLabels[step.platform] || step.platform} &middot; {
                                                step.stepType === "create_draft" ? "创建草稿" :
                                                    step.stepType === "publish_article" ? "正式发布" :
                                                        step.stepType === "validate_account" ? "验证账号" : step.stepType
                                            }
                                        </h3>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            Step {index + 1}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-500 mt-1">
                                        {isRunning ? "正在处理中..." :
                                            isStepCompleted ? "已完成" :
                                                isStepFailed ? step.errorMessage || "发生错误" :
                                                    "等待中"}
                                    </p>

                                    {isStepFailed && (
                                        <div className="mt-2 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100">
                                            {step.errorMessage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/30 backdrop-blur-sm flex items-center justify-between gap-4">
                {!isCompleted && !isFailed ? (
                    <Button variant="ghost" className="w-full text-slate-500" onClick={onClose}>
                        最小化到后台
                    </Button>
                ) : (
                    <>
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            关闭
                        </Button>
                        <Button className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800 text-white" onClick={onViewDetails}>
                            查看发布详情 <ChevronRight className="w-4 h-4" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
