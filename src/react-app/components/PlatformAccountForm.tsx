import { useState } from "react";
import type { PlatformAccount, PlatformType } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, Shield, ShieldCheck, ShieldX } from "lucide-react";

const platformOptions: { value: PlatformType; label: string; icon: string }[] = [
	{ value: "juejin", label: "掘金", icon: "🔥" },
	{ value: "zhihu", label: "知乎", icon: "💡" },
	{ value: "xiaohongshu", label: "小红书", icon: "📕" },
	{ value: "wechat", label: "微信公众号", icon: "💬" },
	{ value: "csdn", label: "CSDN", icon: "📝" },
];

interface PlatformAccountFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account?: PlatformAccount | null;
	onSave: (data: {
		platform: PlatformType;
		authToken?: string;
		description?: string;
	}) => void;
	onVerify?: (accountId: string) => void;
}

export function PlatformAccountForm({
	open,
	onOpenChange,
	account,
	onSave,
	onVerify,
}: PlatformAccountFormProps) {
	const [formData, setFormData] = useState({
		platform: "" as PlatformType,
		authToken: "",
		description: "",
	});
	const [showAuthToken, setShowAuthToken] = useState(false);
	const [saving, setSaving] = useState(false);
	const [verifying, setVerifying] = useState(false);

	const isEditing = !!account;
	const isPlatformDisabled = isEditing;

	React.useEffect(() => {
		if (open) {
			if (account) {
				setFormData({
					platform: account.platform,
					authToken: account.authToken ?? "",
					description: account.description ?? "",
				});
			} else {
				setFormData({
					platform: "" as PlatformType,
					authToken: "",
					description: "",
				});
			}
		}
	}, [open, account]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.platform) {
			return;
		}

		setSaving(true);
		try {
			onSave({
				platform: formData.platform,
				authToken: formData.authToken || undefined,
				description: formData.description || undefined,
			});
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	};

	const handleVerify = async () => {
		if (!account) return;
		setVerifying(true);
		try {
			await onVerify?.(account.id);
		} finally {
			setVerifying(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEditing ? "编辑认证信息" : "新增平台认证"}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* 平台选择 */}
					<div className="space-y-2">
						<Label>平台</Label>
						<div className="grid grid-cols-5 gap-2">
							{platformOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									disabled={isPlatformDisabled}
									onClick={() => setFormData((prev) => ({ ...prev, platform: option.value }))}
									className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-all ${
										formData.platform === option.value
											? "border-brand-500 bg-brand-50 text-brand-700"
											: "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
									} ${isPlatformDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
								>
									<span className="text-xl">{option.icon}</span>
									<span className="text-xs font-medium">{option.label}</span>
								</button>
							))}
						</div>
					</div>

					{/* 认证信息 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="authToken">认证 Token / Cookie</Label>
							<button
								type="button"
								onClick={() => setShowAuthToken(!showAuthToken)}
								className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
							>
								{showAuthToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
								{showAuthToken ? "隐藏" : "显示"}
							</button>
						</div>
						{showAuthToken ? (
							<Textarea
								id="authToken"
								value={formData.authToken}
								onChange={(e) => setFormData((prev) => ({ ...prev, authToken: e.target.value }))}
								placeholder="输入平台的认证 Token 或 Cookie"
								className="min-h-[100px] font-mono text-sm"
							/>
						) : (
							<div className="relative">
								<Input
									id="authToken"
									type="password"
									value={formData.authToken}
									onChange={(e) => setFormData((prev) => ({ ...prev, authToken: e.target.value }))}
									placeholder="输入平台的认证 Token 或 Cookie"
									className="min-h-[100px] font-mono text-sm pr-10"
								/>
								<div className="absolute right-3 top-3 text-slate-300">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
										<path d="M7 11V7a5 5 0 0 1 10 0v4" />
									</svg>
								</div>
							</div>
						)}
						<p className="text-xs text-slate-500">
							支持 Token 或 Cookie 格式，不同平台认证方式不同
						</p>
					</div>

					{/* 备注 */}
					<div className="space-y-2">
						<Label htmlFor="description">备注（可选）</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
							placeholder="添加一些备注信息"
							className="min-h-[60px]"
						/>
					</div>

					{/* 验证状态（编辑模式） */}
					{isEditing && account && (
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{account.isVerified ? (
										<ShieldCheck className="h-5 w-5 text-emerald-600" />
									) : (
										<ShieldX className="h-5 w-5 text-slate-400" />
									)}
									<div>
										<p className="text-sm font-medium text-slate-900">
											{account.isVerified ? "已验证" : "未验证"}
										</p>
										<p className="text-xs text-slate-500">
											{account.lastVerifiedAt
												? `上次验证: ${new Date(account.lastVerifiedAt).toLocaleString()}`
												: "请验证帐号的可用性"}
										</p>
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleVerify}
									disabled={verifying}
									className="gap-1"
								>
									{verifying ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Shield className="h-4 w-4" />
									)}
									{verifying ? "验证中..." : "验证"}
								</Button>
							</div>
						</div>
					)}

					{/* 提交按钮 */}
					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							取消
						</Button>
						<Button type="submit" variant="gradient" disabled={!formData.platform || saving}>
							{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isEditing ? "保存" : "添加"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

import React from "react";
