import type { ProviderStatus } from "@/react-app/types";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function ProviderStatusPanel({ status }: { status: ProviderStatus | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-[14px] font-semibold text-design-text">模型服务提供方</p>
          <p className="text-[12px] text-design-textSecondary">{status?.provider ?? "未配置"}</p>
        </div>
        <Switch checked={status?.ready ?? false} disabled />
      </div>
      <Separator />
      <div className="text-[12px] leading-5 text-design-textSecondary">
        <p>最近检测: {status ? new Date(status.lastCheckedAt).toLocaleString("zh-CN") : "-"}</p>
        <p>说明: {status?.message ?? "等待服务端返回"}</p>
      </div>
    </div>
  );
}
