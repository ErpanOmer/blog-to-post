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
  juejin: { label: "掘金", icon: "J", textClass: "text-orange-700", badgeClass: "bg-orange-50 text-orange-700 border-orange-200" },
  zhihu: { label: "知乎", icon: "Z", textClass: "text-blue-700", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  xiaohongshu: { label: "小红书", icon: "X", textClass: "text-rose-700", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  wechat: { label: "公众号", icon: "W", textClass: "text-emerald-700", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  csdn: { label: "CSDN", icon: "C", textClass: "text-sky-700", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
  "": { label: "未知", icon: "?", textClass: "text-slate-700", badgeClass: "bg-slate-50 text-slate-700 border-slate-200" },
};

interface PlatformAccountListProps {
  accounts: PlatformAccount[];
  onEdit: (account: PlatformAccount) => void;
  onDelete: (account: PlatformAccount) => void;
}

export function PlatformAccountList({ accounts, onEdit, onDelete }: PlatformAccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Shield className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">还没有平台账号</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">先补齐常用平台的认证账号，后续分发时才能直接选择目标进行投递。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const config = platformConfig[account.platform];
        const maskedToken = account.authToken ? `${account.authToken.slice(0, 4)}...${account.authToken.slice(-4)}` : null;

        return (
          <article key={account.id} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <Avatar className="h-14 w-14 border border-slate-200">
                  <AvatarImage src={account.avatar || undefined} alt={account.userName || ""} />
                  <AvatarFallback className={config.textClass}>{account.userName?.charAt(0) || config.icon}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-slate-900">{account.userName || config.label}</h3>
                        {account.isVerified ? (
                          <Badge className="gap-1.5 border-transparent bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            已验证
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1.5 text-slate-500">
                            <ShieldX className="h-3.5 w-3.5" />
                            未验证
                          </Badge>
                        )}
                        {!account.isActive && <Badge variant="outline">已停用</Badge>}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={config.badgeClass}>
                          {config.label}
                        </Badge>
                        {account.userId && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-slate-500">
                            ID: {account.userId.slice(0, 16)}...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" className="gap-2" onClick={() => onEdit(account)}>
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(account)}>
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {maskedToken && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <Key className="h-3.5 w-3.5" />
                        <span className="font-mono">{maskedToken}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      创建于 {format(account.createdAt)}
                    </span>
                    {account.lastVerifiedAt && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                        验证于 {format(account.lastVerifiedAt)}
                      </span>
                    )}
                  </div>

                  {account.description && <p className="mt-3 text-sm leading-relaxed text-slate-500">{account.description}</p>}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
