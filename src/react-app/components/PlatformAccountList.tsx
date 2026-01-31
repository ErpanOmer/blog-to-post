import type { PlatformAccount, PlatformType } from "../api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Pencil,
	Trash2,
	Shield,
	ShieldCheck,
	ShieldX,
	Clock,
	Key,
	User,
	CheckCircle2,
} from "lucide-react";
import { format } from "@/lib/utils";

const platformConfig: Record<
	PlatformType,
	{ label: string; icon: string; color: string; bgColor: string; gradient: string }
> = {
	juejin: {
		label: "掘金",
		icon: "🔥",
		color: "text-orange-700",
		bgColor: "bg-orange-50 border-orange-200",
		gradient: "from-orange-400 to-orange-600",
	},
	zhihu: {
		label: "知乎",
		icon: "💡",
		color: "text-blue-700",
		bgColor: "bg-blue-50 border-blue-200",
		gradient: "from-blue-400 to-blue-600",
	},
	xiaohongshu: {
		label: "小红书",
		icon: "📕",
		color: "text-red-700",
		bgColor: "bg-red-50 border-red-200",
		gradient: "from-red-400 to-red-600",
	},
	wechat: {
		label: "公众号",
		icon: "💬",
		color: "text-green-700",
		bgColor: "bg-green-50 border-green-200",
		gradient: "from-green-400 to-green-600",
	},
	csdn: {
		label: "CSDN",
		icon: "📝",
		color: "text-blue-600",
		bgColor: "bg-blue-50 border-blue-200",
		gradient: "from-blue-500 to-blue-700",
	},
	"": {
		label: "未知",
		icon: "❓",
		color: "text-slate-700",
		bgColor: "bg-slate-50 border-slate-200",
		gradient: "from-slate-400 to-slate-600",
	},
};

interface PlatformAccountListProps {
	accounts: PlatformAccount[];
	onEdit: (account: PlatformAccount) => void;
	onDelete: (account: PlatformAccount) => void;
}

export function PlatformAccountList({ accounts, onEdit, onDelete }: PlatformAccountListProps) {
	if (accounts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
					<Shield className="h-8 w-8 text-slate-400" />
				</div>
				<h3 className="text-lg font-semibold text-slate-700 mb-2">暂无平台认证</h3>
				<p className="text-sm text-slate-400">点击右上角按钮添加第一个平台认证</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{accounts.map((account) => {
				const config = platformConfig[account.platform];
				const maskedToken = account.authToken
					? `${account.authToken.slice(0, 4)}...${account.authToken.slice(-4)}`
					: null;

				return (
					<div
						key={account.id}
						className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50"
					>
						{/* 状态指示条 */}
						<div
							className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${
								account.isVerified ? config.gradient : "from-slate-300 to-slate-400"
							}`}
						/>

						<div className="flex items-start gap-4 pl-3">
							{/* 用户头像 */}
							<div className="relative">
								<Avatar className="h-14 w-14 ring-2 ring-slate-100">
									<AvatarImage src={account.avatar || undefined} alt={account.userName || ""} />
									<AvatarFallback className={`${config.bgColor} text-lg`}>
										{account.userName?.charAt(0) || config.icon}
									</AvatarFallback>
								</Avatar>
								{/* 平台小图标 */}
								<div
									className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs shadow-sm ${config.bgColor}`}
								>
									{config.icon}
								</div>
							</div>

							{/* 主体内容 */}
							<div className="flex-1 min-w-0">
								{/* 用户名和验证状态 */}
								<div className="flex items-center gap-2 mb-1">
									<span className="font-semibold text-slate-900">
										{account.userName || config.label}
									</span>
									{account.isVerified ? (
										<Badge className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-1.5 py-0">
											<CheckCircle2 className="h-3 w-3" />
											已验证
										</Badge>
									) : (
										<Badge variant="outline" className="text-xs gap-1 text-slate-500">
											<ShieldX className="h-3 w-3" />
											未验证
										</Badge>
									)}
									{!account.isActive && (
										<Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">
											已禁用
										</Badge>
									)}
								</div>

								{/* 平台标签 */}
								<div className="flex items-center gap-2 mb-2">
									<Badge
										variant="secondary"
										className={`text-xs ${config.color} ${config.bgColor}`}
									>
										{config.label}
									</Badge>
									{account.userId && (
										<span className="text-xs text-slate-400 font-mono">
											ID: {account.userId.slice(0, 16)}...
										</span>
									)}
								</div>

								{/* 认证信息 */}
								<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
									{account.authToken && (
										<div className="flex items-center gap-1">
											<Key className="h-3 w-3" />
											<span className="font-mono">{maskedToken}</span>
										</div>
									)}
									<div className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>创建于 {format(account.createdAt)}</span>
									</div>
									{account.lastVerifiedAt && (
										<span className="text-slate-400">
											验证: {format(account.lastVerifiedAt)}
										</span>
									)}
								</div>

								{/* 备注 */}
								{account.description && (
									<p className="mt-2 text-xs text-slate-400 line-clamp-1">
										{account.description}
									</p>
								)}
							</div>

							{/* 操作按钮 */}
							<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 px-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
									onClick={() => onEdit(account)}
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-8 px-2 text-slate-600 hover:text-red-600 hover:bg-red-50"
									onClick={() => onDelete(account)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
