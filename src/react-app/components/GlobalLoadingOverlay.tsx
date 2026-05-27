import { Loader2 } from "lucide-react";

interface GlobalLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function GlobalLoadingOverlay({ isLoading, message = "智能内容生成中..." }: GlobalLoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-design-border bg-white p-8 text-center shadow-elevated animate-in">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/15" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-500">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-design-text">{message}</p>
          <p className="mt-1 text-[13px] text-design-textSecondary">请稍候，系统正在处理中...</p>
        </div>
      </div>
    </div>
  );
}
