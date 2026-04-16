import type { ReactNode } from "react";
import { AlertCircle, CheckCircle, Clock, FileText, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/react-app/types";

const statusConfig: Record<ArticleStatus, { label: string; className: string; icon: ReactNode }> = {
  draft: {
    label: "草稿",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  reviewed: {
    label: "待审核",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  scheduled: {
    label: "已排期",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  published: {
    label: "已发布",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  failed: {
    label: "失败",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

interface StatusBadgeProps {
  status: ArticleStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
