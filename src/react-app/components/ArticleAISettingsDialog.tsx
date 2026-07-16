import { useState } from "react";
import { Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	getLocalArticleAISettings,
	saveLocalArticleAISettings,
	type ArticleAIFeatureSettings,
	type ArticleAIWorkbenchSettings,
} from "@/react-app/services/article-ai-settings";

interface ArticleAISettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type ArticleAITab = "summary" | "tags";

const tabs: Array<{ key: ArticleAITab; label: string; description: string; promptLabel: string }> = [
	{
		key: "summary",
		label: "文章摘要",
		description: "控制摘要生成的随机度与本地 Prompt。",
		promptLabel: "摘要 Prompt",
	},
	{
		key: "tags",
		label: "文章标签",
		description: "控制标签生成的随机度与本地 Prompt。",
		promptLabel: "标签 Prompt",
	},
];

export function ArticleAISettingsDialog({ open, onOpenChange }: ArticleAISettingsDialogProps) {
	const [activeTab, setActiveTab] = useState<ArticleAITab>("summary");
	const [settings, setSettings] = useState<ArticleAIWorkbenchSettings>(() => getLocalArticleAISettings());

	const updateFeature = <K extends keyof ArticleAIFeatureSettings>(
		feature: ArticleAITab,
		key: K,
		value: ArticleAIFeatureSettings[K],
	) => {
		setSettings((current) => ({
			...current,
			[feature]: { ...current[feature], [key]: value },
		}));
	};

	const handleSave = () => {
		setSettings(saveLocalArticleAISettings(settings));
		toast.success("文章 AI 参数与 Prompt 已保存到当前浏览器");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings2 className="h-4 w-4 text-brand-500" />
						文章 AI 设置
					</DialogTitle>
					<DialogDescription>
						这里仅配置文章摘要和标签的局部参数与 Prompt，并保存在当前浏览器；服务与模型统一使用全局 AI 配置。
					</DialogDescription>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ArticleAITab)}>
					<TabsList className="grid w-full grid-cols-2">
						{tabs.map((tab) => <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>)}
					</TabsList>

					{tabs.map((tab) => (
						<TabsContent key={tab.key} value={tab.key} className="space-y-4 pt-1">
							<p className="text-[13px] text-design-textSecondary">{tab.description}</p>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label>Temperature</Label>
									<Input
										type="number"
										min={0}
										max={2}
										step={0.05}
										value={settings[tab.key].temperature}
										onChange={(event) => updateFeature(tab.key, "temperature", Number(event.target.value))}
									/>
								</div>
								<div className="space-y-1.5">
									<Label>Top P</Label>
									<Input
										type="number"
										min={0}
										max={1}
										step={0.05}
										value={settings[tab.key].topP}
										onChange={(event) => updateFeature(tab.key, "topP", Number(event.target.value))}
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label>{tab.promptLabel}</Label>
								<Textarea
									className="min-h-[180px] font-mono text-[13px] leading-5"
									value={settings[tab.key].prompt}
									onChange={(event) => updateFeature(tab.key, "prompt", event.target.value)}
								/>
								<p className="text-[12px] leading-5 text-design-neutral">
									可在 Prompt 中使用 <code>{"{{ARTICLE_CONTENT}}"}</code>；未使用占位符时，文章正文会作为用户消息附加。
								</p>
							</div>
						</TabsContent>
					))}
				</Tabs>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
					<Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />保存文章 AI 设置</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
