import { useEffect, useMemo, useState } from "react";
import { Cloud, HardDrive, Loader2, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getAIModels } from "@/react-app/api";
import {
	getLocalArticleAISettings,
	saveLocalArticleAISettings,
	type ArticleAIFeatureKey,
	type ArticleAIFeatureSettings,
	type ArticleAIWorkbenchSettings,
} from "@/react-app/services/article-ai-settings";

interface ArticleAISettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type ModelSource = "cloud" | "local" | "unknown";
type EnabledTabKey = "summary" | "tags";

const tabItems: Array<{
	key: ArticleAIFeatureKey;
	label: string;
	enabled: boolean;
	description: string;
}> = [
	{
		key: "summary",
		label: "文章摘要",
		enabled: true,
		description: "用于摘要生成的独立模型参数与 Prompt。",
	},
	{
		key: "tags",
		label: "文章标签",
		enabled: true,
		description: "用于标签生成的独立模型参数与 Prompt。",
	},
	{
		key: "title",
		label: "文章标题",
		enabled: false,
		description: "预留功能，后续开放。",
	},
	{
		key: "content",
		label: "文章正文",
		enabled: false,
		description: "预留功能，后续开放。",
	},
	{
		key: "cover",
		label: "文章封面",
		enabled: false,
		description: "预留功能，后续开放。",
	},
];

const enabledTabKeys = tabItems
	.filter((item) => item.enabled)
	.map((item) => item.key) as EnabledTabKey[];

function isEnabledTabKey(value: string): value is EnabledTabKey {
	return (enabledTabKeys as string[]).includes(value);
}

export function ArticleAISettingsDialog({
	open,
	onOpenChange,
}: ArticleAISettingsDialogProps) {
	const [activeTab, setActiveTab] = useState<EnabledTabKey>("summary");
	const [settings, setSettings] = useState<ArticleAIWorkbenchSettings | null>(null);
	const [cloudModels, setCloudModels] = useState<string[]>([]);
	const [localModels, setLocalModels] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setActiveTab("summary");
		void loadData();
	}, [open]);

	const loadData = async () => {
		setIsLoading(true);
		try {
			const catalog = await getAIModels();
			setCloudModels(catalog.cloudModels);
			setLocalModels(catalog.localModels);
			setSettings(getLocalArticleAISettings());
		} catch (error) {
			console.error("Load article AI settings failed", error);
		} finally {
			setIsLoading(false);
		}
	};

	const modelOptions = useMemo(() => {
		const map = new Map<string, { value: string; source: ModelSource }>();
		const add = (value: string, source: ModelSource, override = false) => {
			const normalized = value.trim();
			if (!normalized) return;
			const key = normalized.toLowerCase();
			if (!map.has(key) || override) {
				map.set(key, { value: normalized, source });
			}
		};

		cloudModels.forEach((model) => add(model, "cloud"));
		localModels.forEach((model) => add(model, "local", true));

		const activeModel = settings?.[activeTab]?.model;
		if (activeModel) {
			add(activeModel, "unknown");
		}

		return Array.from(map.values());
	}, [cloudModels, localModels, settings, activeTab]);

	const renderModelIcon = (source: ModelSource) => {
		if (source === "cloud") {
			return <Cloud className="h-3.5 w-3.5 text-sky-500" />;
		}
		if (source === "local") {
			return <HardDrive className="h-3.5 w-3.5 text-emerald-500" />;
		}
		return <Settings2 className="h-3.5 w-3.5 text-slate-500" />;
	};

	const updateActiveField = <K extends keyof ArticleAIFeatureSettings>(
		key: K,
		value: ArticleAIFeatureSettings[K],
	) => {
		setSettings((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				[activeTab]: {
					...prev[activeTab],
					[key]: value,
				},
			};
		});
	};

	const handleSave = async () => {
		if (!settings) return;
		setIsSaving(true);
		try {
			const saved = saveLocalArticleAISettings(settings);
			setSettings(saved);
			onOpenChange(false);
		} catch (error) {
			console.error("Save article AI settings failed", error);
		} finally {
			setIsSaving(false);
		}
	};

	const activeFeatureSettings = settings?.[activeTab];
	const activeTabMeta = tabItems.find((item) => item.key === activeTab);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>文章 AI 设置</DialogTitle>
					<DialogDescription>
						按功能独立配置模型参数与 Prompt。仅存储在当前浏览器本地。
					</DialogDescription>
				</DialogHeader>

				{isLoading || !settings || !activeFeatureSettings ? (
					<div className="flex items-center justify-center py-10 text-slate-500">
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						加载中...
					</div>
				) : (
					<div className="max-h-[70vh] overflow-y-auto pr-1">
						<Tabs
							value={activeTab}
							onValueChange={(value) => {
								if (isEnabledTabKey(value)) {
									setActiveTab(value);
								}
							}}
						>
							<TabsList className="w-full justify-start overflow-x-auto">
								{tabItems.map((tab) => (
									<TabsTrigger
										key={tab.key}
										value={tab.key}
										disabled={!tab.enabled}
										className={!tab.enabled ? "opacity-45" : ""}
									>
										{tab.label}
										{!tab.enabled ? "（待开放）" : ""}
									</TabsTrigger>
								))}
							</TabsList>

							{enabledTabKeys.map((tabKey) => (
								<TabsContent key={tabKey} value={tabKey} className="space-y-4">
									<p className="text-xs text-slate-500">
										{tabItems.find((item) => item.key === tabKey)?.description}
									</p>

									<div className="space-y-1.5">
										<Label className="text-[12px]">模型</Label>
										<Select
											value={settings[tabKey].model}
											onValueChange={(value) => {
												if (activeTab !== tabKey) return;
												updateActiveField("model", value);
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="选择模型" />
											</SelectTrigger>
											<SelectContent>
												{modelOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														<span className="inline-flex items-center gap-1.5">
															{renderModelIcon(option.source)}
															{option.value}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label className="text-[12px]">temperature</Label>
											<Input
												type="number"
												min={0}
												max={2}
												step={0.1}
												value={settings[tabKey].temperature}
												onChange={(event) => {
													if (activeTab !== tabKey) return;
													const value = Number.parseFloat(event.target.value);
													if (!Number.isFinite(value)) return;
													updateActiveField("temperature", value);
												}}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-[12px]">topP</Label>
											<Input
												type="number"
												min={0}
												max={1}
												step={0.1}
												value={settings[tabKey].topP}
												onChange={(event) => {
													if (activeTab !== tabKey) return;
													const value = Number.parseFloat(event.target.value);
													if (!Number.isFinite(value)) return;
													updateActiveField("topP", value);
												}}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-[12px]">maxTokens</Label>
											<Input
												type="number"
												min={64}
												max={32768}
												step={64}
												value={settings[tabKey].maxTokens}
												onChange={(event) => {
													if (activeTab !== tabKey) return;
													const value = Number.parseInt(event.target.value, 10);
													if (!Number.isFinite(value)) return;
													updateActiveField("maxTokens", value);
												}}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-[12px]">超时(秒)</Label>
											<Input
												type="number"
												min={10}
												max={600}
												step={5}
												value={settings[tabKey].requestTimeoutSec}
												onChange={(event) => {
													if (activeTab !== tabKey) return;
													const value = Number.parseInt(event.target.value, 10);
													if (!Number.isFinite(value)) return;
													updateActiveField("requestTimeoutSec", value);
												}}
											/>
										</div>
									</div>

									<div className="space-y-1.5">
										<Label className="text-[12px]">
											{tabKey === "summary" ? "摘要 Prompt" : "标签 Prompt"}
										</Label>
										<Textarea
											className="min-h-[140px] font-mono text-[12px]"
											value={settings[tabKey].prompt}
											onChange={(event) => {
												if (activeTab !== tabKey) return;
												updateActiveField("prompt", event.target.value);
											}}
										/>
									</div>
								</TabsContent>
							))}
						</Tabs>

						<p className="mt-3 text-xs text-slate-500">
							当前已启用：摘要、标签。标题、正文、封面 Tab 已预留，后续按你的节奏逐步开放。
						</p>

						{activeTabMeta && (
							<p className="mt-1 text-[11px] text-slate-400">
								当前配置项：{activeTabMeta.label}
							</p>
						)}
					</div>
				)}

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						取消
					</Button>
					<Button onClick={() => void handleSave()} disabled={isLoading || isSaving || !settings}>
						{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
						保存设置
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

