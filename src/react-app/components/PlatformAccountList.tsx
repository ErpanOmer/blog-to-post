import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/utils";
import type { PlatformAccount, PlatformType } from "@/react-app/api";
import { CheckCircle2, Clock, Key, Pencil, Shield, ShieldX, Trash2 } from "lucide-react";

const platformConfig: Record<
  PlatformType,
  { label: string; icon: string; textClass: string; badgeClass: string }
> = {
  juejin: { label: "掘金", icon: "J", textClass: "text-orange-600", badgeClass: "bg-orange-50 text-orange-600 border-orange-200/60" },
  zhihu: { label: "知乎", icon: "Z", textClass: "text-blue-600", badgeClass: "bg-blue-50 text-blue-600 border-blue-200/60" },
  xiaohongshu: { label: "小红书", icon: "X", textClass: "text-rose-600", badgeClass: "bg-rose-50 text-rose-600 border-rose-200/60" },
  wechat: { label: "公众号", icon: "W", textClass: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  csdn: { label: "CSDN", icon: "C", textClass: "text-sky-600", badgeClass: "bg-sky-50 text-sky-600 border-sky-200/60" },
  cnblogs: { label: "博客园", icon: "B", textClass: "text-indigo-600", badgeClass: "bg-indigo-50 text-indigo-600 border-indigo-200/60" },
  segmentfault: { label: "SegmentFault", icon: "S", textClass: "text-teal-600", badgeClass: "bg-teal-50 text-teal-600 border-teal-200/60" },
  "": { label: "未知", icon: "?", textClass: "text-slate-600", badgeClass: "bg-slate-50 text-slate-600 border-slate-200" },
};

interface PlatformAccountListProps {
  accounts: PlatformAccount[];
  onEdit: (account: PlatformAccount) => void;
  onDelete: (account: PlatformAccount) => void;
}

export function PlatformAccountList({ accounts, onEdit, onDelete }: PlatformAccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Shield className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">还没有平台账号</h3>
        <p className="mt-1 max-w-sm text-[13px] text-slate-500">先补齐常用平台的认证账号，后续分发时才能直接选择目标。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {accounts.map((account) => {
        const config = platformConfig[account.platform];
        const maskedToken = account.authToken ? `${account.authToken.slice(0, 4)}...${account.authToken.slice(-4)}` : null;

        return (
          <article key={account.id} className="rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-200 hover:shadow-card-hover">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className="h-10 w-10 border border-slate-100">
                  <AvatarImage
                    src={account.avatar || undefined}
                    alt={account.userName || ""}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className={`text-sm ${config.textClass}`}>{account.userName?.charAt(0) || config.icon}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-[14px] font-semibold text-slate-900">{account.userName || config.label}</h3>
                    {account.isVerified ? (
                      <Badge className="gap-1 border-emerald-200/60 bg-emerald-50 text-emerald-600 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        已验证
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-slate-400 text-[10px]">
                        <ShieldX className="h-3 w-3" />
                        未验证
                      </Badge>
                    )}
                    {!account.isActive && <Badge variant="outline" className="text-[10px]">已停用</Badge>}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={`${config.badgeClass} text-[10px]`}>
                      {config.label}
                    </Badge>
                    {account.userId && (
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        {account.userId.slice(0, 12)}...
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    {maskedToken && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5">
                        <Key className="h-3 w-3" />
                        <span className="font-mono">{maskedToken}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5">
                      <Clock className="h-3 w-3" />
                      {format(account.createdAt)}
                    </span>
                    {account.lastVerifiedAt && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-600">
                        验证于 {format(account.lastVerifiedAt)}
                      </span>
                    )}
                  </div>

                  {account.description && <p className="mt-2 text-[13px] text-slate-500">{account.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="xs" className="gap-1 text-slate-500" onClick={() => onEdit(account)}>
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
                <Button variant="ghost" size="xs" className="gap-1 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(account)}>
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}