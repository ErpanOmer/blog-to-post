import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getPromptTemplates, updatePromptTemplate } from "@/react-app/api";
import type { PromptKey, PromptTemplate } from "@/react-app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Globe,
  Key,
  RefreshCw,
  Save,
  Server,
  Settings2,
} from "lucide-react";

interface PlatformSettingsProps {
  providerStatus: {
    provider: string;
    ready: boolean;
    lastCheckedAt: number;
    message: string;
  } | null;
}

const promptDescriptions: Record<string, { title: string; description: string; icon: ReactNode }> = {
  title: {
    title: "标题提示词",
    description: "用于生成文章标题的提示词模板。",
    icon: <FileText className="h-4 w-4" />,
  },
  content: {
    title: "正文提示词",
    description: "用于生成正文内容的提示词模板。",
    icon: <FileText className="h-4 w-4" />,
  },
  summary: {
    title: "摘要提示词",
    description: "用于生成文章摘要的提示词模板。",
    icon: <FileText className="h-4 w-4" />,
  },
  cover: {
    title: "封面提示词",
    description: "用于生成封面建议的提示词模板。",
    icon: <FileText className="h-4 w-4" />,
  },
  tags: {
    title: "标签提示词",
    description: "用于生成标签建议的提示词模板。",
    icon: <FileText className="h-4 w-4" />,
  },
};

export function PlatformSettings({ providerStatus }: PlatformSettingsProps) {
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadPromptTemplates();
  }, []);

  const loadPromptTemplates = async () => {
    setIsLoading(true);
    try {
      const templates = await getPromptTemplates();
      setPromptTemplates(templates);

      const initialEdited: Record<string, string> = {};
      templates.forEach((template) => {
        initialEdited[template.key] = template.template;
      });
      setEditedTemplates(initialEdited);
    } catch (error) {
      console.error("加载提示词模板失败", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = useMemo(
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
      setPromptTemplates((prev) => prev.map((item) => (item.key === key ? { ...item, template: editedTemplates[key] ?? "" } : item)));
      window.setTimeout(() => {
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error("保存提示词模板失败", error);
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai" className="gap-2">
            <Cpu className="h-4 w-4" />
            智能设置
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <FileText className="h-4 w-4" />
            提示词模板
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Server className="h-4 w-4" />
            系统设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-brand-600" />
                <CardTitle>模型服务状态</CardTitle>
              </div>
              <CardDescription>查看当前模型服务连接状态和基础参数。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">当前服务提供方</p>
                    <p className="mt-1 text-xs text-slate-500">{providerStatus?.provider || "未配置"}</p>
                  </div>
                  <Badge variant={providerStatus?.ready ? "default" : "destructive"}>{providerStatus?.ready ? "可用" : "异常"}</Badge>
                </div>
                {providerStatus?.message && <p className="mt-3 text-xs text-slate-500">{providerStatus.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>默认模型</Label>
                  <Input value="qwen2.5:14b" disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>请求超时</Label>
                  <Input value="300s" disabled className="bg-slate-50" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-slate-600" />
                <CardTitle>生成参数</CardTitle>
              </div>
              <CardDescription>这些参数主要影响生成内容的稳定性和长度。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>随机性</Label>
                <Input type="number" defaultValue={0.7} min={0} max={2} step={0.1} />
              </div>
              <div className="space-y-2">
                <Label>最大字数</Label>
                <Input type="number" defaultValue={4096} min={256} max={8192} step={256} />
              </div>
              <div className="space-y-2">
                <Label>采样阈值</Label>
                <Input type="number" defaultValue={0.9} min={0} max={1} step={0.1} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid gap-5">
              {promptTemplates.map((template) => {
                const desc = promptDescriptions[template.key] || {
                  title: template.key,
                  description: "",
                  icon: <FileText className="h-4 w-4" />,
                };
                const isSaving = savingKeys.has(template.key);
                const isSaved = savedKeys.has(template.key);
                const changed = hasChanges(template.key);

                return (
                  <Card key={template.key}>
                    <CardHeader>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{desc.icon}</div>
                          <div>
                            <CardTitle className="text-base">{desc.title}</CardTitle>
                            <CardDescription>{desc.description}</CardDescription>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {changed && <Badge variant="outline">已修改</Badge>}
                          {isSaved && (
                            <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              已保存
                            </Badge>
                          )}
                          <Button size="sm" onClick={() => void handleSaveTemplate(template.key)} disabled={isSaving || !changed}>
                            {isSaving ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                            保存
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={editedTemplates[template.key] || ""}
                        onChange={(event) => handleTemplateChange(template.key, event.target.value)}
                        className="min-h-[220px] font-mono text-sm"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-brand-600" />
                <CardTitle>平台开关</CardTitle>
              </div>
              <CardDescription>统一控制哪些平台当前允许参与分发。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {["掘金", "知乎", "小红书", "公众号", "CSDN"].map((platform) => (
                <div key={platform} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-sm font-medium text-slate-700">{platform}</span>
                  <div className="flex items-center gap-2">
                    <Switch id={`${platform}-enabled`} defaultChecked />
                    <Label htmlFor={`${platform}-enabled`} className="text-sm">
                      已启用
                    </Label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-600" />
                <CardTitle>存储配置</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>数据库</Label>
                <Input value="D1 (SQLite)" disabled className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>缓存</Label>
                <Input value="KV" disabled className="bg-slate-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-slate-600" />
                <CardTitle>密钥管理</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>接口密钥</Label>
                <div className="flex gap-2">
                  <Input type="password" value="************************" disabled className="flex-1 bg-slate-50" />
                  <Button variant="outline" size="sm">
                    重置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
