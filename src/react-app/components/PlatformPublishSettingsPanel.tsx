import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	PLATFORM_DISPLAY_NAMES,
	PLATFORM_SHORT_ICONS,
	PUBLISHABLE_PLATFORMS,
	normalizePlatformPublishSettings,
} from "@/shared/platform-settings";
import type {
	PlatformPublishSetting,
	PlatformPublishSettingsMap,
	PublishablePlatformType,
} from "@/shared/types";
import {
	getPlatformPublishSettings,
	updatePlatformPublishSettings,
} from "@/react-app/api";
import { Loader2, Save, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformPublishSettingsPanelProps {
	initialPlatform?: PublishablePlatformType;
	initialSettings?: PlatformPublishSettingsMap;
	persist?: boolean;
	onSaved?: (settings: PlatformPublishSettingsMap) => void;
}

const platformDescriptions: Record<PublishablePlatformType, string> = {
	juejin: "Markdown 草稿与发布，支持封面和内容图上传。",
	zhihu: "知乎专栏 HTML 内容发布，适合保留图文结构。",
	wechat: "微信公众号官方草稿发布流程，HTML 会做微信专属处理。",
	csdn: "CSDN 同时提交 Markdown 和 HTML，代码块使用 Prism。",
	cnblogs: "博客园 Markdown 编辑器投稿流程。",
	segmentfault: "SegmentFault Markdown 草稿与发布流程。",
};

export function PlatformPublishSettingsPanel({
	initialPlatform = "juejin",
	initialSettings,
	persist = true,
	onSaved,
}: PlatformPublishSettingsPanelProps) {
	const [settings, setSettings] = useState<PlatformPublishSettingsMap>(() =>
		normalizePlatformPublishSettings(initialSettings),
	);
	const [activePlatform, setActivePlatform] = useState<PublishablePlatformType>(initialPlatform);
	const [isLoading, setIsLoading] = useState(persist && !initialSettings);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setActivePlatform(initialPlatform);
	}, [initialPlatform]);

	useEffect(() => {
		if (initialSettings) {
			setSettings(normalizePlatformPublishSettings(initialSettings));
			setIsLoading(false);
		}
	}, [initialSettings]);

	useEffect(() => {
		if (!persist || initialSettings) return;

		let cancelled = false;
		const loadSettings = async () => {
			setIsLoading(true);
			try {
				const remote = await getPlatformPublishSettings();
				if (!cancelled) {
					setSettings(normalizePlatformPublishSettings(remote));
				}
			} catch (error) {
				console.error("Load platform publish settings failed", error);
				toast.error("加载平台发布设置失败");
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void loadSettings();
		return () => {
			cancelled = true;
		};
	}, [initialSettings, persist]);

	const activeSetting = settings[activePlatform];
	const enabledCount = useMemo(
		() => PUBLISHABLE_PLATFORMS.filter((platform) => settings[platform]?.enabled).length,
		[settings],
	);

	const updateActiveSetting = <K extends keyof PlatformPublishSetting>(
		key: K,
		value: PlatformPublishSetting[K],
	) => {
		setSettings((prev) => ({
			...prev,
			[activePlatform]: {
				...prev[activePlatform],
				[key]: value,
			},
		}));
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			if (!persist) {
				const normalized = normalizePlatformPublishSettings(settings);
				setSettings(normalized);
				onSaved?.(normalized);
				toast.success("本次发布设置已应用");
				return;
			}

			const saved = await updatePlatformPublishSettings(settings);
			const normalized = normalizePlatformPublishSettings(saved);
			setSettings(normalized);
			onSaved?.(normalized);
			window.dispatchEvent(new CustomEvent("platform-publish-settings-updated", { detail: normalized }));
			toast.success("平台发布设置已保存");
		} catch (error) {
			console.error("Save platform publish settings failed", error);
			toast.error(persist ? "保存平台发布设置失败" : "应用本次发布设置失败");
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
				<Loader2 className="h-5 w-5 animate-spin text-slate-300" />
			</div>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
			<Card className="h-fit">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-sm">
						<Settings2 className="h-4 w-4 text-brand-500" />
						平台
					</CardTitle>
					<CardDescription>已启用 {enabledCount} / {PUBLISHABLE_PLATFORMS.length}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-1.5">
					{PUBLISHABLE_PLATFORMS.map((platform) => {
						const item = settings[platform];
						const active = platform === activePlatform;
						return (
							<button
								key={platform}
								type="button"
								onClick={() => setActivePlatform(platform)}
								className={cn(
									"flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
									active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
								)}
							>
								<span className="inline-flex min-w-0 items-center gap-2">
									<span className={cn(
										"inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold",
										active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500",
									)}>
										{PLATFORM_SHORT_ICONS[platform]}
									</span>
									<span className="truncate">{PLATFORM_DISPLAY_NAMES[platform]}</span>
								</span>
								<span className={cn(
									"h-2 w-2 rounded-full",
									item.enabled ? "bg-emerald-400" : "bg-slate-300",
								)} />
							</button>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-base">
								<span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
									{PLATFORM_SHORT_ICONS[activePlatform]}
								</span>
								{PLATFORM_DISPLAY_NAMES[activePlatform]} 发布设置
							</CardTitle>
							<CardDescription className="mt-1">{platformDescriptions[activePlatform]}</CardDescription>
						</div>
						<Badge variant={activeSetting.enabled ? "default" : "outline"} className="w-fit text-[10px]">
							{activeSetting.enabled ? "启用中" : "已禁用"}
						</Badge>
					</div>
				</CardHeader>

				<CardContent className="space-y-5">
					<div className="grid gap-3 md:grid-cols-3">
						<div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<Label className="text-sm font-medium text-slate-800">启用平台</Label>
									<p className="mt-1 text-xs text-slate-500">
										{persist ? "关闭后发布入口隐藏，账号只读。" : "关闭后本次任务不会投递该平台。"}
									</p>
								</div>
								<Switch
									checked={activeSetting.enabled}
									onCheckedChange={(checked) => updateActiveSetting("enabled", checked)}
								/>
							</div>
						</div>

						<div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<Label className="text-sm font-medium text-slate-800">仅发布草稿</Label>
									<p className="mt-1 text-xs text-slate-500">开启后草稿创建成功即任务成功。</p>
								</div>
								<Switch
									checked={activeSetting.draftOnly}
									onCheckedChange={(checked) => updateActiveSetting("draftOnly", checked)}
								/>
							</div>
						</div>

						<div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<Label className="text-sm font-medium text-slate-800">封面作为 HEADER_SLOT</Label>
									<p className="mt-1 text-xs text-slate-500">开启后头部内容框不可编辑。</p>
								</div>
								<Switch
									checked={activeSetting.useCoverImageAsHeader}
									onCheckedChange={(checked) => updateActiveSetting("useCoverImageAsHeader", checked)}
								/>
							</div>
						</div>
					</div>

					<div className="grid gap-4 xl:grid-cols-2">
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor={`${activePlatform}-header-slot`} className="text-sm font-medium text-slate-800">
									HEADER_SLOT
								</Label>
								{activeSetting.useCoverImageAsHeader ? (
									<span className="text-xs text-slate-400">已由封面图接管</span>
								) : null}
							</div>
							<Textarea
								id={`${activePlatform}-header-slot`}
								value={activeSetting.headerSlot}
								onChange={(event) => updateActiveSetting("headerSlot", event.target.value)}
								disabled={activeSetting.useCoverImageAsHeader}
								placeholder="默认留空。填写后会插入到文章最前面，也可配合 {{HEADER_SLOT}} 指定位置。"
								className="min-h-[180px] font-mono text-[12px]"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor={`${activePlatform}-footer-slot`} className="text-sm font-medium text-slate-800">
								FOOTER_SLOT
							</Label>
							<Textarea
								id={`${activePlatform}-footer-slot`}
								value={activeSetting.footerSlot}
								onChange={(event) => updateActiveSetting("footerSlot", event.target.value)}
								placeholder="默认留空。填写后会插入到文章最底部，也可配合 {{FOOTER_SLOT}} 指定位置。"
								className="min-h-[180px] font-mono text-[12px]"
							/>
						</div>
					</div>

					<div className="flex justify-end border-t border-slate-100 pt-4">
						<Button onClick={() => void handleSave()} disabled={isSaving} className="gap-1.5">
							{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
							{persist ? "保存平台发布设置" : "应用到本次发布"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
