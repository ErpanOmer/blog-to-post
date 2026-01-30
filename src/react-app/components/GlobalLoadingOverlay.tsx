import { Loader2 } from "lucide-react";

interface GlobalLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function GlobalLoadingOverlay({ isLoading, message = "AI生成中..." }: GlobalLoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </div>
        <p className="text-base font-semibold text-slate-900">{message}</p>
        <p className="text-sm text-slate-500">请稍候，正在努力生成中...</p>
      </div>
    </div>
  );
}
