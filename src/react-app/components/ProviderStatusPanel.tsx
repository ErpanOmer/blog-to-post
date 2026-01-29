import type { ProviderStatus } from "../types";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function ProviderStatusPanel({ status }: { status: ProviderStatus | null }) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-slate-900">当前 Provider</p>
					<p className="text-xs text-slate-500">{status?.provider ?? "未配置"}</p>
				</div>
				<Switch checked={status?.ready ?? false} disabled />
			</div>
			<Separator />
			<div className="text-xs text-slate-500">
				<p>上次检测：{status ? new Date(status.lastCheckedAt).toLocaleString() : "-"}</p>
				<p>说明：{status?.message ?? "等待后端返回"}</p>
			</div>
		</div>
	);
}
