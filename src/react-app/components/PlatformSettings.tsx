import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Cpu, Database, FileText, Globe, Key, RefreshCw, Save, Server } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AIConfigurationPanel } from "@/react-app/components/AIConfigurationPanel";
import { PlatformPublishSettingsPanel } from "@/react-app/components/PlatformPublishSettingsPanel";
import { getPromptTemplates, updatePromptTemplate } from "@/react-app/api";
import type { PromptKey, PromptTemplate } from "@/react-app/types";

const promptDescriptions: Record<string, { title: string; description: string; icon: ReactNode }> = {
	title: { title: "标题提示词", description: "用于生成文章标题的提示模板", icon: <FileText className="h-3.5 w-3.5" /> },
	content: { title: "正文提示词", description: "用于生成正文内容的提示模板", icon: <FileText className="h-3.5 w-3.5" /> },
	summary: { title: "摘要提示词", description: "用于生成文章摘要的提示模板", icon: <FileText className="h-3.5 w-3.5" /> },
	cover: { title: "封面提示词", description: "用于生成封面建议的提示模板", icon: <FileText className="h-3.5 w-3.5" /> },
	tags: { title: "标签提示词", description: "用于生成标签建议的提示模板", icon: <FileText className="h-3.5 w-3.5" /> },
};

export function PlatformSettings() {
	const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
	const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
	const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
	const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
	const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

	useEffect(() => {
		void (async () => {
			setIsLoadingPrompts(true);
			try {
				const templates = await getPromptTemplates();
				setPromptTemplates(templates);
				setEditedTemplates(Object.fromEntries(templates.map((template) => [template.key, template.template])));
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "加载提示词模板失败");
			} finally {
				setIsLoadingPrompts(false);
			}
		})();
	}, []);

	const hasPromptChanges = useMemo(
		() => (key: string) => promptTemplates.find((template) => template.key === key)?.template !== editedTemplates[key],
		[editedTemplates, promptTemplates],
	);

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
			setPromptTemplates((prev) => prev.map((item) => item.key === key ? { ...item, template: editedTemplates[key] ?? "" } : item));
			toast.success("提示词已保存");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "保存提示词失败");
		} finally {
			setSavingKeys((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		}
	};

	return (
		<div className="space-y-5 page-enter">
			<Tabs defaultValue="ai" className="space-y-5">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="ai" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />智能设置</TabsTrigger>
					<TabsTrigger value="publish" className="gap-1.5"><Globe className="h-3.5 w-3.5" />发布设置</TabsTrigger>
					<TabsTrigger value="prompts" className="gap-1.5"><FileText className="h-3.5 w-3.5" />提示词模板</TabsTrigger>
					<TabsTrigger value="system" className="gap-1.5"><Server className="h-3.5 w-3.5" />系统设置</TabsTrigger>
				</TabsList>

				<TabsContent value="ai" className="space-y-4">
					<AIConfigurationPanel />
				</TabsContent>

				<TabsContent value="publish" className="space-y-4"><PlatformPublishSettingsPanel /></TabsContent>

				<TabsContent value="prompts" className="space-y-4">
					{isLoadingPrompts ? <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-design-neutral" /></div> : (
						<div className="grid gap-4">
							{promptTemplates.map((template) => {
								const desc = promptDescriptions[template.key] ?? { title: template.key, description: "", icon: <FileText className="h-3.5 w-3.5" /> };
								const isSaving = savingKeys.has(template.key);
								const isSaved = savedKeys.has(template.key);
								const changed = hasPromptChanges(template.key);
								return <Card key={template.key}>
									<CardHeader className="pb-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-500">{desc.icon}</div><div><CardTitle className="text-base">{desc.title}</CardTitle><CardDescription className="mt-0.5">{desc.description}</CardDescription></div></div><div className="flex items-center gap-1.5">{changed ? <Badge variant="outline">已修改</Badge> : null}{isSaved ? <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-3 w-3" />已保存</Badge> : null}<Button size="xs" onClick={() => void handleSaveTemplate(template.key)} disabled={isSaving || !changed}>{isSaving ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}保存</Button></div></div></CardHeader>
									<CardContent><Textarea value={editedTemplates[template.key] || ""} onChange={(event) => handleTemplateChange(template.key, event.target.value)} className="min-h-[180px] font-mono text-[13px] leading-5" /></CardContent>
								</Card>;
							})}
						</div>
					)}
				</TabsContent>

				<TabsContent value="system" className="space-y-4">
					<Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-design-textSecondary" />存储配置</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>数据库</Label><Input value="D1 (SQLite)" disabled className="bg-design-background" /></div><div className="space-y-1.5"><Label>缓存</Label><Input value="KV" disabled className="bg-design-background" /></div></CardContent></Card>
					<Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Key className="h-4 w-4 text-design-textSecondary" />密钥管理</CardTitle><CardDescription>全局 AI 配置中的 API Key 使用 ENCRYPTION_KEY 加密存储。</CardDescription></CardHeader><CardContent><Input type="password" value="服务端加密存储，不回传浏览器" disabled className="bg-design-background" /></CardContent></Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
