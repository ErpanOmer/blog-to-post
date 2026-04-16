import { Loader2 } from "lucide-react";

interface GlobalLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function GlobalLoadingOverlay({ isLoading, message = "智能内容生成中..." }: GlobalLoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/75 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(247,241,234,0.95))] p-8 text-center shadow-[0_42px_120px_-52px_rgba(15,23,42,0.68)]">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-brand shadow-glow">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </div>
        <p className="font-display text-2xl font-semibold text-slate-900">{message}</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-500">请稍候，系统正在整理生成结果、同步编辑状态并准备下一步动作。</p>
      </div>
    </div>
  );
}
