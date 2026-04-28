import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	FileText,
	Hash,
	ImageIcon,
	Layers,
	Loader2,
	Rocket,
	Upload,
	User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
	getPlatformAccounts,
	getPlatformPublishSettings,
	getPublishTask,
	getPublishTaskSteps,
	type PlatformAccount,
} from "@/react-app/api";
import { PublishProgress } from "./PublishProgress";
import { PlatformPublishSettingsDialog } from "./PlatformPublishSettingsDialog";
import type { Article } from "@/react-app/types";
import type { AccountConfig, PublishTask, PublishTaskStep } from "@/react-app/types/publications";
import {
	PLATFORM_DISPLAY_NAMES,
	PLATFORM_SHORT_ICONS,
	isPublishablePlatform,
	normalizePlatformPublishSettings,
} from "@/shared/platform-settings";
import type { PlatformPublishSetting, PlatformPublishSettingsMap, PublishablePlatformType } from "@/shared/types";

interface PublishDialogProps {
	articles: Article[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPublishConfirm?: (accountConfigs: AccountConfig[], scheduleTime: number | null) => Promise<string | null>;
	onQuickPublishConfirm?: (accountConfigs: AccountConfig[], scheduleTime: number | null) => Promise<string | null>;
	isQuickPublish?: boolean;
	onTaskCompleted?: (taskId: string) => void;
}

const articleStatusLabels: Record<string, string> = {
	draft: "草稿",
	reviewed: "已审核",
	scheduled: "待发布",
	published: "已发布",
	failed: "发布失败",
};

function toContentSlots(setting: PlatformPublishSetting): NonNullable<AccountConfig["contentSlots"]> {
	return {
		useCoverImageAsHeader: setting.useCoverImageAsHeader,
		headerSlot: setting.useCoverImageAsHeader ? "" : setting.headerSlot,
		footerSlot: setting.footerSlot,
		headerMarkdown: setting.useCoverImageAsHeader ? "" : setting.headerSlot,
		headerHtml: setting.useCoverImageAsHeader ? "" : setting.headerSlot,
		footerMarkdown: setting.footerSlot,
		footerHtml: setting.footerSlot,
	};
}

function buildAccountConfig(
	account: PlatformAccount,
	settings: PlatformPublishSettingsMap,
): AccountConfig | null {
	if (!isPublishablePlatform(account.platform)) return null;
	const setting = settings[account.platform];
	if (!setting.enabled) return null;
	return {
		accountId: account.id,
		platform: account.platform,
		draftOnly: setting.draftOnly,
		contentSlots: toContentSlots(setting),
	};
}

function buildAccountConfigMap(
	accounts: PlatformAccount[],
	settings: PlatformPublishSettingsMap,
): Map<string, AccountConfig> {
	const configs = new Map<string, AccountConfig>();
	accounts.forEach((account) => {
		const config = buildAccountConfig(account, settings);
		if (config) configs.set(account.id, config);
	});
	return configs;
}

function getPlatformBadgeText(setting: PlatformPublishSetting): string {
	const parts = [setting.draftOnly ? "仅草稿" : "直接发布"];
	if (setting.useCoverImageAsHeader) parts.push("封面 HEADER");
	else if (setting.headerSlot.trim()) parts.push("自定义 HEADER");
	if (setting.footerSlot.trim()) parts.push("自定义 FOOTER");
	return parts.join(" · ");
}

export function PublishDialog({
	articles,
	open,
	onOpenChange,
	onPublishConfirm,
	onQuickPublishConfirm,
	isQuickPublish = false,
	onTaskCompleted,
}: PublishDialogProps) {
	const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
	const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
	const [accountConfigs, setAccountConfigs] = useState<Map<string, AccountConfig>>(new Map());
	const [platformSettings, setPlatformSettings] = useState<PlatformPublishSettingsMap>(() => normalizePlatformPublishSettings());
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsInitialPlatform, setSettingsInitialPlatform] = useState<PublishablePlatformType>("juejin");
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [publishMode, setPublishMode] = useState<"immediate" | "scheduled">("immediate");
	const [scheduleDate, setScheduleDate] = useState("");
	const [scheduleClock, setScheduleClock] = useState("");
	const [showArticles, setShowArticles] = useState(false);
	const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
	const [taskProgress, setTaskProgress] = useState<PublishTask | null>(null);
	const [taskSteps, setTaskSteps] = useState<PublishTaskStep[]>([]);
	const [isPolling, setIsPolling] = useState(false);

	const accountsByPlatform = useMemo(
		() =>
			accounts.reduce<Record<string, PlatformAccount[]>>((acc, account) => {
				if (!acc[account.platform]) acc[account.platform] = [];
				acc[account.platform].push(account);
				return acc;
			}, {}),
		[accounts],
	);

	const loadAccounts = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [allAccounts, remoteSettings] = await Promise.all([
				getPlatformAccounts(),
				getPlatformPublishSettings(),
			]);
			const settings = normalizePlatformPublishSettings(remoteSettings);
			const activeAccounts = allAccounts.filter((item) => {
				if (!item.isActive || !item.isVerified || !isPublishablePlatform(item.platform)) return false;
				return settings[item.platform].enabled;
			});

			setPlatformSettings(settings);
			setAccounts(activeAccounts);
			setSelectedAccounts(new Set(activeAccounts.map((item) => item.id)));
			setAccountConfigs(buildAccountConfigMap(activeAccounts, settings));
		} catch (loadError) {
			console.error("加载平台账号失败", loadError);
			setError("加载平台账号失败。");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!open) return;
		void loadAccounts();
		setShowArticles(false);
		setError(null);
		setSuccess(null);
		setIsSubmitting(false);
		setCurrentTaskId(null);
		setTaskProgress(null);
		setTaskSteps([]);
		setIsPolling(false);
		setPublishMode("immediate");
		setScheduleDate("");
		setScheduleClock("");
	}, [loadAccounts, open]);

	useEffect(() => {
		const handleSettingsUpdated = () => {
			if (open) void loadAccounts();
		};
		window.addEventListener("platform-publish-settings-updated", handleSettingsUpdated);
		return () => window.removeEventListener("platform-publish-settings-updated", handleSettingsUpdated);
	}, [loadAccounts, open]);

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval> | undefined;

		if (isPolling && currentTaskId) {
			const fetchProgress = async () => {
				try {
					const [taskData, stepsData] = await Promise.all([
						getPublishTask(currentTaskId).then((res) => res.task),
						getPublishTaskSteps(currentTaskId),
					]);

					setTaskProgress(taskData);
					setTaskSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber));

					if (["completed", "failed", "cancelled"].includes(taskData.status)) {
						setIsPolling(false);
						setIsSubmitting(false);
						setSuccess(taskData.status === "completed" ? "发布任务已完成。" : null);

						if (taskData.status === "failed") {
							setError("发布任务执行失败，请查看详细步骤。");
						}
					}
				} catch (pollError) {
					console.error("轮询任务状态失败", pollError);
				}
			};

			void fetchProgress();
			intervalId = setInterval(() => void fetchProgress(), 3000);
		}

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, [currentTaskId, isPolling]);

	const toggleAccount = (accountId: string) => {
		const account = accounts.find((item) => item.id === accountId);
		if (!account || !isPublishablePlatform(account.platform) || !platformSettings[account.platform].enabled) {
			return;
		}
		setSelectedAccounts((prev) => {
			const next = new Set(prev);
			if (next.has(accountId)) next.delete(accountId);
			else next.add(accountId);
			return next;
		});
	};

	const togglePlatform = (platform: string, checked: boolean) => {
		if (!isPublishablePlatform(platform) || !platformSettings[platform].enabled) return;
		const platformAccounts = accountsByPlatform[platform] || [];
		setSelectedAccounts((prev) => {
			const next = new Set(prev);
			platformAccounts.forEach((account) => {
				if (checked) next.add(account.id);
				else next.delete(account.id);
			});
			return next;
		});
	};

	const openPlatformSettings = (platform: string) => {
		if (!isPublishablePlatform(platform)) return;
		setSettingsInitialPlatform(platform);
		setSettingsOpen(true);
	};

	const handleSettingsSaved = (settings: PlatformPublishSettingsMap) => {
		setPlatformSettings(settings);
		setAccountConfigs(buildAccountConfigMap(accounts, settings));
		setSelectedAccounts((prev) => {
			const next = new Set<string>();
			accounts.forEach((account) => {
				if (prev.has(account.id) && isPublishablePlatform(account.platform) && settings[account.platform].enabled) {
					next.add(account.id);
				}
			});
			return next;
		});
		setSettingsOpen(false);
	};

	const selectAll = () => {
		setSelectedAccounts(new Set(
			accounts
				.filter((item) => isPublishablePlatform(item.platform) && platformSettings[item.platform].enabled)
				.map((item) => item.id),
		));
	};
	const deselectAll = () => setSelectedAccounts(new Set());

	const handlePublish = async () => {
		if (selectedAccounts.size === 0) {
			setError("请至少选择一个发布账号。");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		setSuccess(null);

		try {
			const configs: AccountConfig[] = [];
			selectedAccounts.forEach((accountId) => {
				const account = accounts.find((item) => item.id === accountId);
				if (!account) return;
				const config = buildAccountConfig(account, platformSettings) ?? accountConfigs.get(accountId);
				if (config) configs.push(config);
			});

			if (configs.length === 0) {
				setError("已选择的账号所属平台都不可用，请检查平台发布设置。");
				setIsSubmitting(false);
				return;
			}

			let scheduleTimeMs: number | null = null;
			if (publishMode === "scheduled" && scheduleDate && scheduleClock) {
				const dateTime = new Date(`${scheduleDate}T${scheduleClock}`);
				scheduleTimeMs = dateTime.getTime();
				if (scheduleTimeMs <= Date.now()) {
					setError("定时发布时间必须晚于当前时间。");
					setIsSubmitting(false);
					return;
				}
			}

			let taskId: string | null = null;
			if (isQuickPublish && onQuickPublishConfirm) {
				taskId = await onQuickPublishConfirm(configs, scheduleTimeMs);
			} else if (onPublishConfirm) {
				taskId = await onPublishConfirm(configs, scheduleTimeMs);
			}

			if (taskId) {
				setCurrentTaskId(taskId);
				setIsPolling(true);
			} else {
				setSuccess("发布任务已创建。");
				setTimeout(() => onOpenChange(false), 1200);
			}
		} catch (publishError) {
			console.error("创建发布任务失败", publishError);
			setError(publishError instanceof Error ? publishError.message : "创建发布任务失败。");
			setIsSubmitting(false);
		}
	};

	const handleViewDetails = () => {
		if (!currentTaskId || !onTaskCompleted) return;
		onTaskCompleted(currentTaskId);
		onOpenChange(false);
	};

	const isSingleArticle = articles.length === 1;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
				<DialogHeader className="border-b border-slate-100 px-5 py-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<DialogTitle className="flex items-center gap-2 text-base">
								{isQuickPublish ? <Rocket className="h-4 w-4 text-brand-500" /> : <Upload className="h-4 w-4 text-brand-500" />}
								{isSingleArticle ? "发布文章" : `批量发布 ${articles.length} 篇文章`}
							</DialogTitle>
							<DialogDescription className="mt-1 text-[13px] text-slate-500">
								选择投递账号。草稿、HEADER_SLOT 和 FOOTER_SLOT 会继承全局发布设置，点击 ⚙ 可仅为本次任务调整。
							</DialogDescription>
						</div>

						<Badge variant="secondary" className="w-fit text-[10px]">
							已选 {articles.length} 篇
						</Badge>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-5">
					<div className="space-y-5">
						<Card className="border-slate-200">
							<button
								onClick={() => setShowArticles((prev) => !prev)}
								className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
								type="button"
							>
								<div className="flex items-center gap-2">
									<FileText className="h-4 w-4 text-slate-500" />
									<span className="text-sm font-medium text-slate-700">待发布文章</span>
									<Badge variant="outline" className="text-[11px]">
										{articles.length} 篇
									</Badge>
								</div>
								{showArticles ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
							</button>

							{showArticles && (
								<CardContent className="p-0">
									<ScrollArea className="max-h-[240px] overflow-y-auto">
										<div className="divide-y divide-slate-100">
											{articles.map((article, index) => (
												<div key={article.id} className="flex items-center gap-3 px-4 py-3">
													<span className="w-6 text-xs text-slate-400">{index + 1}</span>
													{article.coverImage ? (
														<img src={article.coverImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
													) : (
														<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
															<ImageIcon className="h-4 w-4 text-slate-300" />
														</div>
													)}
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium text-slate-800">{article.title || "未命名文章"}</p>
														<div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
															<span>{articleStatusLabels[article.status] || article.status}</span>
															{article.tags?.length ? (
																<span className="inline-flex items-center gap-1">
																	<Hash className="h-3 w-3" />
																	{article.tags.slice(0, 2).join(", ")}
																	{article.tags.length > 2 ? ` +${article.tags.length - 2}` : ""}
																</span>
															) : null}
														</div>
													</div>
												</div>
											))}
										</div>
									</ScrollArea>
								</CardContent>
							)}
						</Card>

						<section className="rounded-xl border border-slate-200 bg-white p-4">
							<div className="mb-3 flex items-center gap-2">
								<Calendar className="h-4 w-4 text-slate-500" />
								<Label className="text-sm font-semibold text-slate-800">发布方式</Label>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<button
									type="button"
									onClick={() => setPublishMode("immediate")}
									className={cn(
										"rounded-xl border px-4 py-4 text-left transition-colors",
										publishMode === "immediate"
											? "border-brand-500 bg-brand-50"
											: "border-slate-200 bg-white hover:border-slate-300",
									)}
								>
									<div className="flex items-center gap-2 text-sm font-medium text-slate-900">
										<Rocket className="h-4 w-4 text-brand-600" />
										立即发布
									</div>
									<p className="mt-1 text-xs text-slate-500">创建任务后立刻开始执行，适合常规分发。</p>
								</button>

								<button
									type="button"
									onClick={() => setPublishMode("scheduled")}
									className={cn(
										"rounded-xl border px-4 py-4 text-left transition-colors",
										publishMode === "scheduled"
											? "border-brand-500 bg-brand-50"
											: "border-slate-200 bg-white hover:border-slate-300",
									)}
								>
									<div className="flex items-center gap-2 text-sm font-medium text-slate-900">
										<Clock className="h-4 w-4 text-brand-600" />
										定时发布
									</div>
									<p className="mt-1 text-xs text-slate-500">指定未来时间执行，适合排期运营场景。</p>
								</button>
							</div>

							{publishMode === "scheduled" && (
								<div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_180px]">
									<Input
										type="date"
										value={scheduleDate}
										onChange={(event) => setScheduleDate(event.target.value)}
										min={new Date().toISOString().split("T")[0]}
									/>
									<Input type="time" value={scheduleClock} onChange={(event) => setScheduleClock(event.target.value)} />
								</div>
							)}
						</section>

						<section className="rounded-xl border border-slate-200 bg-white p-4">
							<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div className="flex items-center gap-2">
									<Layers className="h-4 w-4 text-slate-500" />
									<Label className="text-sm font-semibold text-slate-800">选择发布账号</Label>
									<Badge variant="outline" className="text-[11px]">
										已选 {selectedAccounts.size} 个
									</Badge>
								</div>

								<div className="flex items-center gap-2">
									<Button variant="ghost" size="sm" onClick={selectAll}>
										全选
									</Button>
									<Button variant="ghost" size="sm" onClick={deselectAll}>
										清空
									</Button>
								</div>
							</div>

							{isLoading ? (
								<div className="flex items-center justify-center py-12 text-sm text-slate-500">
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									正在加载可用账号...
								</div>
							) : accounts.length === 0 ? (
								<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
									<User className="mx-auto mb-3 h-10 w-10 text-slate-300" />
									<p className="text-sm font-medium text-slate-700">暂无可用账号</p>
									<p className="mt-1 text-xs text-slate-500">请先完成账号新增、校验，并确认对应平台已在发布设置中启用。</p>
								</div>
							) : (
								<div className="space-y-4">
									{Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => {
										const platformSelected = platformAccounts.every((item) => selectedAccounts.has(item.id));
										const platformPartial = platformAccounts.some((item) => selectedAccounts.has(item.id)) && !platformSelected;
										const setting = isPublishablePlatform(platform) ? platformSettings[platform] : null;
										const platformDisabled = !setting?.enabled;

										return (
											<div key={platform} className={cn("overflow-hidden rounded-xl border border-slate-200", platformDisabled && "opacity-65")}>
												<div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
													<Checkbox
														checked={platformSelected}
														disabled={platformDisabled}
														onCheckedChange={(checked) => togglePlatform(platform, checked === true)}
														className={cn(platformPartial && "border-brand-500 bg-brand-500")}
													/>
													<span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-600">
														{isPublishablePlatform(platform) ? PLATFORM_SHORT_ICONS[platform] : "?"}
													</span>
													<div className="min-w-0 flex-1">
														<p className="text-sm font-medium text-slate-900">{isPublishablePlatform(platform) ? PLATFORM_DISPLAY_NAMES[platform] : platform}</p>
														<p className="text-xs text-slate-500">{platformAccounts.length} 个可用账号</p>
													</div>
													{setting ? (
														<Badge variant="outline" className="hidden border-slate-200 bg-white text-[10px] text-slate-500 sm:inline-flex">
															{setting.enabled ? getPlatformBadgeText(setting) : "本次禁用"}
														</Badge>
													) : null}
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-base text-slate-500"
														onClick={() => openPlatformSettings(platform)}
														aria-label="平台发布设置"
													>
														⚙
													</Button>
												</div>

												<div className="divide-y divide-slate-100">
													{platformAccounts.map((account) => {
														const config = buildAccountConfig(account, platformSettings) ?? accountConfigs.get(account.id);
														const isSelected = selectedAccounts.has(account.id);
														const draftOnly = config?.draftOnly ?? setting?.draftOnly ?? true;
														const headerUsesCover = config?.contentSlots?.useCoverImageAsHeader ?? setting?.useCoverImageAsHeader ?? false;
														const headerSlot = config?.contentSlots?.headerSlot ?? setting?.headerSlot ?? "";
														const accountDisabled = platformDisabled;

														return (
															<div
																key={account.id}
																className={cn(
																	"flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center",
																	isSelected ? "bg-white" : "bg-slate-50/70",
																)}
															>
																<div className="flex min-w-0 flex-1 items-center gap-3">
																	<Checkbox checked={isSelected} disabled={accountDisabled} onCheckedChange={() => toggleAccount(account.id)} />

																	{account.avatar ? (
																		<img src={account.avatar} alt={account.userName || ""} className="h-9 w-9 rounded-full object-cover" />
																	) : (
																		<div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
																			{account.userName?.[0] || "?"}
																		</div>
																	)}

																	<div className="min-w-0">
																		<p className="truncate text-sm font-medium text-slate-900">{account.userName || "未命名账号"}</p>
																		<p className="truncate text-xs text-slate-500">
																			{account.description || "已验证，可直接用于文章分发"}
																		</p>
																	</div>
																</div>

																<div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
																	<Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-500">
																		{draftOnly ? "仅草稿" : "正式发布"}
																	</Badge>
																	<Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-500">
																		{headerUsesCover ? "封面作为 HEADER" : headerSlot.trim() ? "自定义 HEADER" : "无 HEADER"}
																	</Badge>
																</div>
															</div>
														);
													})}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</section>

						{error && (
							<div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								<AlertCircle className="h-4 w-4 flex-shrink-0" />
								{error}
							</div>
						)}

						{success && (
							<div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
								<CheckCircle2 className="h-4 w-4 flex-shrink-0" />
								{success}
							</div>
						)}
					</div>
				</div>

				{currentTaskId && taskProgress && (
					<div className="absolute inset-0 z-50 bg-white">
						<PublishProgress task={taskProgress} steps={taskSteps} article={articles[0]} onClose={() => onOpenChange(false)} onViewDetails={handleViewDetails} />
					</div>
				)}

				<DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						取消
					</Button>
					<Button size="sm" onClick={() => void handlePublish()} disabled={isSubmitting || selectedAccounts.size === 0 || isLoading}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
								提交中...
							</>
						) : publishMode === "scheduled" ? (
							<>
								<Clock className="mr-1.5 h-3.5 w-3.5" />
								创建定时任务
							</>
						) : (
							<>
								<Rocket className="mr-1.5 h-3.5 w-3.5" />
								立即发布
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>

			<PlatformPublishSettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				initialPlatform={settingsInitialPlatform}
				initialSettings={platformSettings}
				persist={false}
				onSaved={handleSettingsSaved}
			/>
		</Dialog>
	);
}
