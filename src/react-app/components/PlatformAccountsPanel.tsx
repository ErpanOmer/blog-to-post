import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  createPlatformAccount,
  deletePlatformAccount,
  getPlatformAccount,
  getPlatformAccounts,
  updatePlatformAccount,
  verifyPlatformAccount,
  type PlatformAccount,
  type PlatformType,
} from "@/react-app/api";
import { PlatformAccountForm } from "./PlatformAccountForm";
import { PlatformAccountList } from "./PlatformAccountList";
import { Filter, Loader2, Plus } from "lucide-react";

const platformFilters: { value: PlatformType | "all"; label: string; icon: string }[] = [
  { value: "all", label: "全部", icon: "ALL" },
  { value: "juejin", label: "掘金", icon: "J" },
  { value: "zhihu", label: "知乎", icon: "Z" },
  { value: "xiaohongshu", label: "小红书", icon: "X" },
  { value: "wechat", label: "公众号", icon: "W" },
  { value: "csdn", label: "CSDN", icon: "C" },
];

export function PlatformAccountsPanel() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlatformType | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PlatformAccount | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const platform = filter === "all" ? undefined : filter;
      const data = await getPlatformAccounts(platform);
      setAccounts(data);
    } catch (error) {
      console.error("获取平台账号失败", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAccounts();
  }, [filter]);

  const handleCreate = async (data: { platform: PlatformType; authToken?: string; description?: string }) => {
    try {
      await createPlatformAccount(data);
      toast.success("账号添加成功");
      await fetchAccounts();
    } catch (error) {
      console.error("创建账号失败", error);
      toast.error("创建失败，请稍后重试");
    }
  };

  const handleUpdate = async (data: { platform: PlatformType; authToken?: string; description?: string }) => {
    if (!editingAccount) return;
    try {
      await updatePlatformAccount(editingAccount.id, {
        authToken: data.authToken,
        description: data.description,
      });
      toast.success("账号更新成功");
      await fetchAccounts();
    } catch (error) {
      console.error("更新账号失败", error);
      toast.error("保存失败，请稍后重试");
    }
  };

  const handleVerify = async (accountId: string) => {
    try {
      const result = await verifyPlatformAccount(accountId);
      toast[result.valid ? "success" : "error"](result.message);

      await fetchAccounts();
      if (editingAccount && editingAccount.id === accountId) {
        const updated = await getPlatformAccount(accountId);
        setEditingAccount(updated);
      }
    } catch (error) {
      console.error("验证账号失败", error);
      toast.error("验证失败，请稍后重试");
    }
  };

  const handleDelete = async (account: PlatformAccount) => {
    setConfirmDialog({
      open: true,
      title: "删除平台账号",
      description: "确认删除该平台账号吗？此操作不可撤销。",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await deletePlatformAccount(account.id);
          toast.success("账号已删除");
          setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchAccounts();
        } catch (error) {
          console.error("删除账号失败", error);
          toast.error("删除失败，请稍后重试");
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const filteredAccounts = filter === "all" ? accounts : accounts.filter((item) => item.platform === filter);

  return (
    <div className="space-y-5">
      <section className="surface-subtle flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow-label mb-2">Accounts</p>
          <p className="text-sm leading-relaxed text-slate-600">管理分发所需的平台认证信息。支持按平台筛选、编辑备注、重新验证和删除账号。</p>
        </div>
        <Button variant="default" size="sm" onClick={() => setFormOpen(true)} className="gap-2 self-start md:self-auto">
          <Plus className="h-4 w-4" />
          新增账号
        </Button>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Filter className="h-4 w-4" />
            <span>筛选平台</span>
          </div>

          {platformFilters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === item.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <Badge variant="secondary" className="self-start px-3 py-1.5 md:self-auto">
          账号总数 {filteredAccounts.length}
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <PlatformAccountList
          accounts={filteredAccounts}
          onEdit={(account) => {
            setEditingAccount(account);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
        />
      )}

      <PlatformAccountForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingAccount(null);
        }}
        account={editingAccount}
        onSave={editingAccount ? handleUpdate : handleCreate}
        onVerify={handleVerify}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="确认删除"
        variant="destructive"
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}
