import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
	getAIModelSettings,
	getAIModels,
	getPromptTemplates,
	updateAIModelSettings,
	updatePromptTemplate,
} from "@/react-app/api";
import type {
	AIModelSettings,
	PromptKey,
	PromptTemplate,
	ProviderStatus,
} from "@/react-app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	CheckCircle2,
	Cloud,
	Cpu,
	Database,
	FileText,
	Globe,
	HardDrive,
	Key,
	RefreshCw,
	Save,
	Server,
} from "lucide-react";

interface PlatformSettingsProps {
	providerStatus: ProviderStatus | null;
}

type ModelOptionSource = "cloud" | "local" | "unknown";

const promptDescriptions: Record<string, { title: string; description: string; icon: ReactNode }> = {
	title: {
		title: "标题提示词",
		description: "用于生成文章标题的提示模板",
		icon: <FileText className="h-3.5 w-3.5" />,
	},
	content: {
		title: "正文提示词",
		description: "用于生成正文内容的提示模板",
		icon: <FileText className="h-3.5 w-3.5" />,
	},
	summary: {
		title: "摘要提示词",
		description: "用于生成文章摘要的提示模板",
		icon: <FileText className="h-3.5 w-3.5" />,
	},
	cover: {
		title: "封面提示词",
		description: "用于生成封面建议的提示模板",
		icon: <FileText className="h-3.5 w-3.5" />,
	},
	tags: {
		title: "标签提示词",
		description: "用于生成标签建议的提示模板",
		icon: <FileText className="h-3.5 w-3.5" />,
	},
};

export function PlatformSettings({ providerStatus }: PlatformSettingsProps) {
	const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
	const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
	const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
	const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
	const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

	const [aiSettings, setAISettings] = useState<AIModelSettings | null>(null);
	const [aiModels, setAIModels] = useState<string[]>([]);
	const [cloudModels, setCloudModels] = useState<string[]>([]);
	const [localModels, setLocalModels] = useState<string[]>([]);
	const [isLoadingModels, setIsLoadingModels] = useState(true);
	const [isSavingAISettings, setIsSavingAISettings] = useState(false);

	useEffect(() => {
		void loadPromptTemplates();
		void loadAISettings();
	}, []);

	const modelOptions = useMemo(() => {
		const options = new Map<string, { value: string; source: ModelOptionSource }>();
		const addModel = (model: string, source: ModelOptionSource, override = false) => {
			const value = model.trim();
			if (!value) return;
			const dedupeKey = value.toLowerCase();
			if (!options.has(dedupeKey) || override) {
				options.set(dedupeKey, { value, source });
			}
		};

		cloudModels.forEach((model) => addModel(model, "cloud"));
		localModels.forEach((model) => addModel(model, "local", true));
		aiModels.forEach((model) => addModel(model, "unknown"));
		if (aiSettings?.defaultModel) {
			addModel(aiSettings.defaultModel, "unknown");
		}

		return Array.from(options.values());
	}, [aiModels, aiSettings?.defaultModel, cloudModels, localModels]);

	const hasPromptChanges = useMemo(
		() => (key: string) => promptTemplates.find((template) => template.key === key)?.template !== editedTemplates[key],
		[editedTemplates, promptTemplates],
	);

	const loadPromptTemplates = async () => {
		setIsLoadingPrompts(true);
		try {
			const templates = await getPromptTemplates();
			setPromptTemplates(templates);

			const initialEdited: Record<string, string> = {};
			templates.forEach((template) => {
				initialEdited[template.key] = template.template;
			});
			setEditedTemplates(initialEdited);
		} catch (error) {
			console.error("Load prompt templates failed", error);
		} finally {
			setIsLoadingPrompts(false);
		}
	};

	const loadAISettings = async () => {
		setIsLoadingModels(true);
		try {
			const [settings, modelCatalog] = await Promise.all([
				getAIModelSettings(),
				getAIModels(),
			]);
			setAISettings(settings);
			setAIModels(modelCatalog.models);
			setCloudModels(modelCatalog.cloudModels);
			setLocalModels(modelCatalog.localModels);
		} catch (error) {
			console.error("Load AI settings failed", error);
		} finally {
			setIsLoadingModels(false);
		}
	};

	const handleTemplateChange = (key: string, value: string) => {
		setEditedTemplates((prev) => ({ ...prev, [key]: value }));
		setSavedKeys((prev) => {
			const next = new Set(prev);
			next.delete(key);
			return next;
		});
	};

	const handleSaveTemplate = async (key: string) => {
		setSavingKeys((prev) => new Set(prev).add(key));
		try {
			await updatePromptTemplate(key as PromptKey, editedTemplates[key] ?? "");
			setSavedKeys((prev) => new Set(prev).add(key));
			setPromptTemplates((prev) => prev.map((item) => (item.key === key ? { ...item, template: editedTemplates[key] ?? "" } : item)));
			window.setTimeout(() => {
				setSavedKeys((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			}, 2000);
		} catch (error) {
			console.error("Save prompt template failed", error);
		} finally {
			setSavingKeys((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		}
	};

	const handleSaveAISettings = async () => {
		if (!aiSettings) return;
		setIsSavingAISettings(true);
		try {
			const saved = await updateAIModelSettings(aiSettings);
			setAISettings(saved);
			const catalog = await getAIModels();
			setAIModels(catalog.models);
			setCloudModels(catalog.cloudModels);
			setLocalModels(catalog.localModels);
		} catch (error) {
			console.error("Save AI settings failed", error);
		} finally {
			setIsSavingAISettings(false);
		}
	};

	const updateAIField = <K extends keyof AIModelSettings>(key: K, value: AIModelSettings[K]) => {
		setAISettings((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				[key]: value,
			};
		});
	};

	const renderModelIcon = (source: ModelOptionSource) => {
		if (source === "cloud") {
			return <Cloud className="h-3.5 w-3.5 text-sky-500" />;
		}
		if (source === "local") {
			return <HardDrive className="h-3.5 w-3.5 text-emerald-500" />;
		}
		return <Cpu className="h-3.5 w-3.5 text-slate-500" />;
	};

	return (
		<div className="space-y-5 page-enter">
			<Tabs defaultValue="ai" className="space-y-5">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="ai" className="gap-1.5">
						<Cpu className="h-3.5 w-3.5" />
						智能设置
					</TabsTrigger>
					<TabsTrigger value="prompts" className="gap-1.5">
						<FileText className="h-3.5 w-3.5" />
						提示词模板
					</TabsTrigger>
					<TabsTrigger value="system" className="gap-1.5">
						<Server className="h-3.5 w-3.5" />
						系统设置
					</TabsTrigger>
				</TabsList>

				<TabsContent value="ai" className="space-y-4">
					<Card>
						<CardHeader className="pb-3">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-center gap-2">
									<Cpu className="h-4 w-4 text-brand-500" />
									<CardTitle className="text-sm">模型服务与模型选择</CardTitle>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="xs"
										onClick={() => void loadAISettings()}
										disabled={isLoadingModels || isSavingAISettings}
										className="gap-1"
									>
										<RefreshCw className={`h-3 w-3 ${isLoadingModels ? "animate-spin" : ""}`} />
										刷新模型
									</Button>
									<Button
										size="xs"
										onClick={() => void handleSaveAISettings()}
										disabled={!aiSettings || isLoadingModels || isSavingAISettings}
										className="gap-1"
									>
										{isSavingAISettings ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
										保存配置
									</Button>
								</div>
							</div>
							<CardDescription>AI 能力统一使用一个模型，按需切换即可。</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3">
								<div>
									<p className="text-[13px] font-medium text-slate-800">当前服务提供方</p>
									<p className="mt-0.5 text-[12px] text-slate-400">{providerStatus?.provider || "未配置"}</p>
								</div>
								<Badge variant={providerStatus?.ready ? "default" : "destructive"} className="text-[10px]">
									{providerStatus?.ready ? "可用" : "异常"}
								</Badge>
							</div>

							{providerStatus?.message && <p className="text-[12px] text-slate-400">{providerStatus.message}</p>}

							<div className="space-y-1.5">
								<Label className="text-[12px]">统一模型</Label>
								<Select
									value={aiSettings?.defaultModel ?? ""}
									onValueChange={(value) => updateAIField("defaultModel", value)}
									disabled={!aiSettings || isLoadingModels}
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
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="prompts" className="space-y-4">
					{isLoadingPrompts ? (
						<div className="flex items-center justify-center py-12">
							<RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
						</div>
					) : (
						<div className="grid gap-4">
							{promptTemplates.map((template) => {
								const desc = promptDescriptions[template.key] || {
									title: template.key,
									description: "",
									icon: <FileText className="h-3.5 w-3.5" />,
								};
								const isSaving = savingKeys.has(template.key);
								const isSaved = savedKeys.has(template.key);
								const changed = hasPromptChanges(template.key);

								return (
									<Card key={template.key}>
										<CardHeader className="pb-3">
											<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
												<div className="flex items-center gap-2.5">
													<div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-500">{desc.icon}</div>
													<div>
														<CardTitle className="text-sm">{desc.title}</CardTitle>
														<CardDescription className="mt-0.5">{desc.description}</CardDescription>
													</div>
												</div>

												<div className="flex items-center gap-1.5">
													{changed && <Badge variant="outline" className="text-[10px]">已修改</Badge>}
													{isSaved && (
														<Badge variant="outline" className="gap-1 border-emerald-200/60 bg-emerald-50 text-emerald-600 text-[10px]">
															<CheckCircle2 className="h-3 w-3" />
															已保存
														</Badge>
													)}
													<Button size="xs" onClick={() => void handleSaveTemplate(template.key)} disabled={isSaving || !changed} className="gap-1">
														{isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
														保存
													</Button>
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<Textarea
												value={editedTemplates[template.key] || ""}
												onChange={(event) => handleTemplateChange(template.key, event.target.value)}
												className="min-h-[180px] font-mono text-[12px]"
											/>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</TabsContent>

				<TabsContent value="system" className="space-y-4">
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4 text-brand-500" />
								<CardTitle className="text-sm">平台开关</CardTitle>
							</div>
							<CardDescription>控制哪些平台参与分发</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{["掘金", "知乎", "小红书", "公众号", "CSDN"].map((platform) => (
								<div key={platform} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3">
									<span className="text-[13px] font-medium text-slate-700">{platform}</span>
									<div className="flex items-center gap-2">
										<Switch id={`${platform}-enabled`} defaultChecked />
										<Label htmlFor={`${platform}-enabled`} className="text-[12px] text-slate-500">启用</Label>
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Database className="h-4 w-4 text-slate-500" />
								<CardTitle className="text-sm">存储配置</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-[12px]">数据库</Label>
								<Input value="D1 (SQLite)" disabled className="bg-slate-50 text-[13px]" />
							</div>
							<div className="space-y-1.5">
								<Label className="text-[12px]">缓存</Label>
								<Input value="KV" disabled className="bg-slate-50 text-[13px]" />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Key className="h-4 w-4 text-slate-500" />
								<CardTitle className="text-sm">密钥管理</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="space-y-1.5">
								<Label className="text-[12px]">接口密钥</Label>
								<div className="flex gap-2">
									<Input type="password" value="************************" disabled className="flex-1 bg-slate-50 text-[13px]" />
									<Button variant="outline" size="xs">重置</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
