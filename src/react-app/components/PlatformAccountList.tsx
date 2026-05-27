import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/utils";
import type { PlatformAccount } from "@/react-app/api";
import { PlatformBadge, PlatformLogo } from "@/react-app/components/PlatformBrand";
import { getPlatformDisplayName } from "@/react-app/components/platform-brand-data";
import { isPublishablePlatform } from "@/shared/platform-settings";
import type { PlatformPublishSettingsMap } from "@/shared/types";
import { CheckCircle2, Clock, Eye, Key, Pencil, Shield, ShieldX, Trash2 } from "lucide-react";

interface PlatformAccountListProps {
	accounts: PlatformAccount[];
	onEdit: (account: PlatformAccount) => void;
	onDelete: (account: PlatformAccount) => void;
	platformSettings?: PlatformPublishSettingsMap;
}

function isAccountPlatformDisabled(
	account: PlatformAccount,
	settings?: PlatformPublishSettingsMap,
): boolean {
	return isPublishablePlatform(account.platform) && settings?.[account.platform]?.enabled === false;
}

export function PlatformAccountList({ accounts, onEdit, onDelete, platformSettings }: PlatformAccountListProps) {
	if (accounts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-design-border bg-design-background py-16 text-center">
				<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-design-text text-white">
					<Shield className="h-5 w-5" />
				</div>
				<h3 className="font-display text-lg font-semibold text-design-text">还没有平台账号</h3>
				<p className="mt-1 max-w-sm text-[13px] text-design-textSecondary">先补齐常用平台的认证账号，后续分发时才能直接选择目标。</p>
			</div>
		);
	}

	return (
		<div className="space-y-2.5">
			{accounts.map((account) => {
				const label = getPlatformDisplayName(account.platform);
				const disabledByPlatform = isAccountPlatformDisabled(account, platformSettings);
				const maskedToken = account.authToken ? `${account.authToken.slice(0, 4)}...${account.authToken.slice(-4)}` : null;

				return (
					<article
						key={account.id}
						className="rounded-xl border border-design-border bg-white p-4"
					>
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="flex min-w-0 flex-1 items-start gap-3">
								<Avatar className="h-10 w-10 border border-design-border">
									<AvatarImage
										src={account.avatar || undefined}
										alt={account.userName || ""}
										referrerPolicy="no-referrer"
									/>
									<AvatarFallback className="bg-transparent">
										<PlatformLogo platform={account.platform} size="md" className="ring-0" />
									</AvatarFallback>
								</Avatar>

								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-1.5">
										<h3 className="truncate text-[14px] font-semibold text-design-text">{account.userName || label}</h3>
										{account.isVerified ? (
											<Badge className="gap-1 border-emerald-200/60 bg-emerald-50 text-emerald-600 text-[10px]">
												<CheckCircle2 className="h-3 w-3" />
												已验证
											</Badge>
										) : (
											<Badge variant="outline" className="gap-1 text-[10px] text-design-neutral">
												<ShieldX className="h-3 w-3" />
												未验证
											</Badge>
										)}
										{!account.isActive && <Badge variant="outline" className="text-[10px]">已停用</Badge>}
										{disabledByPlatform && (
											<Badge variant="outline" className="border-amber-200/70 bg-amber-50 text-amber-700 text-[10px]">
												平台已禁用，只读
											</Badge>
										)}
									</div>

									<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
										<PlatformBadge platform={account.platform} size="xs" />
										{account.userId && (
											<span className="rounded-md bg-design-background px-1.5 py-0.5 font-mono text-[10px] text-design-neutral">
												{account.userId.slice(0, 12)}...
											</span>
										)}
									</div>

									<div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-design-neutral">
										{maskedToken && (
											<span className="inline-flex items-center gap-1 rounded-md bg-design-background px-1.5 py-0.5">
												<Key className="h-3 w-3" />
												<span className="font-mono">{maskedToken}</span>
											</span>
										)}
										<span className="inline-flex items-center gap-1 rounded-md bg-design-background px-1.5 py-0.5">
											<Clock className="h-3 w-3" />
											{format(account.createdAt)}
										</span>
										{account.lastVerifiedAt && (
											<span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-600">
												验证于 {format(account.lastVerifiedAt)}
											</span>
										)}
									</div>

									{account.description && <p className="mt-2 text-[13px] text-design-textSecondary">{account.description}</p>}
								</div>
							</div>

							<div className="flex items-center gap-1.5">
								<Button variant="ghost" size="xs" className="gap-1 text-design-textSecondary" onClick={() => onEdit(account)}>
									{disabledByPlatform ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
									{disabledByPlatform ? "查看" : "编辑"}
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
