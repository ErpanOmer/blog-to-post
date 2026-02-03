import { useState, useEffect } from "react";
import type { PlatformAccount, PlatformType } from "@/react-app/api";
import {
	getPlatformAccounts,
	getPlatformAccount,
	createPlatformAccount,
	updatePlatformAccount,
	deletePlatformAccount,
	verifyPlatformAccount,
} from "@/react-app/api";
import { PlatformAccountList } from "./PlatformAccountList";
import { PlatformAccountForm } from "./PlatformAccountForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Filter } from "lucide-react";

const platformFilters: { value: PlatformType | "all"; label: string; icon: string }[] = [
	{ value: "all", label: "全部", icon: "🌐" },
	{ value: "juejin", label: "掘金", icon: "🔥" },
	{ value: "zhihu", label: "知乎", icon: "💡" },
	{ value: "xiaohongshu", label: "小红书", icon: "📕" },
	{ value: "wechat", label: "公众号", icon: "💬" },
	{ value: "csdn", label: "CSDN", icon: "📝" },
];

export function PlatformAccountsPanel() {
	const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<PlatformType | "all">("all");
	const [formOpen, setFormOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<PlatformAccount | null>(null);

	const fetchAccounts = async () => {
		setLoading(true);
		try {
			const platform = filter === "all" ? undefined : filter;
			const data = await getPlatformAccounts(platform);
			setAccounts(data);
		} catch (error) {
			console.error("获取平台认证失败", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAccounts();
	}, [filter]);

	const handleCreate = async (data: {
		platform: PlatformType;
		authToken?: string;
		description?: string;
	}) => {
		console.log('🔍 [前端 handleCreate] 接收到的数据:', data);
		try {
			const result = await createPlatformAccount(data);
			console.log('🔍 [前端 handleCreate] API 返回结果:', result);
			toast.success("添加成功");
			await fetchAccounts();
		} catch (error) {
			console.error("创建认证失败", error);
			toast.error("创建失败，请稍后重试");
		}
	};

	const handleUpdate = async (data: {
		platform: PlatformType;
		authToken?: string;
		description?: string;
	}) => {
		if (!editingAccount) return;
		try {
			await updatePlatformAccount(editingAccount.id, {
				authToken: data.authToken,
				description: data.description,
			});
			toast.success("保存成功");
			await fetchAccounts();
		} catch (error) {
			console.error("更新认证失败", error);
			toast.error("保存失败，请稍后重试");
		}
	};

	const handleVerify = async (accountId: string) => {
		try {
			const result = await verifyPlatformAccount(accountId);

			if (result.valid) {
				toast.success(result.message);
			} else {
				toast.error(result.message);
			}

			await fetchAccounts();

			if (editingAccount && editingAccount.id === accountId) {
				const updatedAccount = await getPlatformAccount(accountId);
				setEditingAccount(updatedAccount);
			}
		} catch (error) {
			console.error("验证失败", error);
			toast.error("验证失败，请稍后重试");
		}
	};

	const handleDelete = async (account: PlatformAccount) => {
		if (!confirm(`确定要删除该平台认证吗？删除后无法恢复。`)) {
			return;
		}
		try {
			await deletePlatformAccount(account.id);
			toast.success("删除成功");
			await fetchAccounts();
		} catch (error) {
			console.error("删除认证失败", error);
			toast.error("删除失败，请稍后重试");
		}
	};

	const handleEdit = (account: PlatformAccount) => {
		setEditingAccount(account);
		setFormOpen(true);
	};

	const handleFormClose = () => {
		setFormOpen(false);
		setEditingAccount(null);
	};

	const filteredAccounts =
		filter === "all" ? accounts : accounts.filter((a) => a.platform === filter);

	return (
		<div className="space-y-6">
			{/* 顶部操作栏 */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				{/* 平台筛选 */}
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5 text-sm text-slate-500">
						<Filter className="h-4 w-4" />
						<span>筛选:</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{platformFilters.map((f) => (
							<button
								key={f.value}
								onClick={() => setFilter(f.value)}
								className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter === f.value
									? "bg-slate-900 text-white"
									: "bg-slate-100 text-slate-600 hover:bg-slate-200"
									}`}
							>
								<span>{f.icon}</span>
								<span>{f.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* 新增按钮 */}
				<Button
					variant="gradient"
					size="sm"
					onClick={() => setFormOpen(true)}
					className="gap-2"
				>
					<Plus className="h-4 w-4" />
					新增认证
				</Button>
			</div>

			{/* 统计信息 */}
			<div className="flex items-center gap-4 text-sm">
				<span className="text-slate-500">
					共 <span className="font-semibold text-slate-900">{filteredAccounts.length}</span> 个认证
				</span>
				{filter !== "all" && (
					<Badge variant="secondary" className="text-xs">
						{platformFilters.find((f) => f.value === filter)?.label}
					</Badge>
				)}
			</div>

			{/* 列表 */}
			{loading ? (
				<div className="flex items-center justify-center py-16">
					<Loader2 className="h-8 w-8 animate-spin text-slate-400" />
				</div>
			) : (
				<PlatformAccountList
					accounts={filteredAccounts}
					onEdit={handleEdit}
					onDelete={handleDelete}
				/>
			)}

			{/* 表单弹窗 */}
			<PlatformAccountForm
				open={formOpen}
				onOpenChange={setFormOpen}
				account={editingAccount}
				onSave={editingAccount ? handleUpdate : handleCreate}
				onVerify={handleVerify}
			/>
		</div>
	);
}
