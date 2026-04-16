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
import { Loader2, Plus } from "lucide-react";

const platformFilters: { value: PlatformType | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "juejin", label: "掘金" },
  { value: "zhihu", label: "知乎" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "wechat", label: "公众号" },
  { value: "csdn", label: "CSDN" },
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-slate-500">管理分发所需的平台认证信息</p>
        <Button variant="default" size="sm" onClick={() => setFormOpen(true)} className="gap-1.5 self-start md:self-auto">
          <Plus className="h-3.5 w-3.5" />
          新增账号
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {platformFilters.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-all duration-200 ${
              filter === item.value
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">{filteredAccounts.length} 个账号</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
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
