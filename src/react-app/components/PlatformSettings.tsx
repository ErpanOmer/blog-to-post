import { useState, useEffect } from "react";
import type { PromptTemplate } from "@/react-app/types";
import { getPromptTemplates, updatePromptTemplate, getProviderStatus } from "@/react-app/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings2, 
  Cpu, 
  FileText, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Code2,
  Sparkles,
  Zap,
  Globe,
  Database,
  Key,
  Server
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformSettingsProps {
  providerStatus: { 
    provider: string; 
    ready: boolean; 
    lastCheckedAt: number; 
    message: string 
  } | null;
}

const promptDescriptions: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  title: {
    title: "标题生成",
    description: "用于生成文章标题的 Prompt 模板",
    icon: <FileText className="h-4 w-4" />,
  },
  content: {
    title: "内容生成",
    description: "用于生成文章正文的 Prompt 模板",
    icon: <Code2 className="h-4 w-4" />,
  },
  summary: {
    title: "摘要生成",
    description: "用于生成文章摘要的 Prompt 模板",
    icon: <Sparkles className="h-4 w-4" />,
  },
  cover: {
    title: "封面生成",
    description: "用于生成文章封面的 Prompt 模板",
    icon: <Zap className="h-4 w-4" />,
  },
};

export function PlatformSettings({ providerStatus }: PlatformSettingsProps) {
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPromptTemplates();
  }, []);

  const loadPromptTemplates = async () => {
    try {
      const templates = await getPromptTemplates();
      setPromptTemplates(templates);
      const initialEdits: Record<string, string> = {};
      templates.forEach(t => {
        initialEdits[t.key] = t.template;
      });
      setEditedTemplates(initialEdits);
    } catch (error) {
      console.error("加载模板失败", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (key: string, value: string) => {
    setEditedTemplates(prev => ({ ...prev, [key]: value }));
    setSavedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleSaveTemplate = async (key: string) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await updatePromptTemplate(key as import("../types").PromptKey, editedTemplates[key]);
      setSavedKeys(prev => new Set(prev).add(key));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error("保存模板失败", error);
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const hasChanges = (key: string) => {
    const original = promptTemplates.find(t => t.key === key)?.template;
    return original !== editedTemplates[key];
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-white/80 p-1 shadow-soft">
          <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            <Cpu className="h-4 w-4" />
            AI 配置
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            <FileText className="h-4 w-4" />
            Prompt 模板
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-500 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            <Server className="h-4 w-4" />
            系统设置
          </TabsTrigger>
        </TabsList>

        {/* AI 配置 */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-brand-500" />
                <CardTitle>AI Provider 配置</CardTitle>
              </div>
              <CardDescription>配置 AI 模型和连接参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 当前状态 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      providerStatus?.ready ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <div>
                      <p className="font-medium text-sm">当前 Provider</p>
                      <p className="text-xs text-slate-500">{providerStatus?.provider || "未配置"}</p>
                    </div>
                  </div>
                  <Badge variant={providerStatus?.ready ? "default" : "destructive"}>
                    {providerStatus?.ready ? "运行中" : "异常"}
                  </Badge>
                </div>
                {providerStatus?.message && (
                  <p className="mt-2 text-xs text-slate-500">{providerStatus.message}</p>
                )}
              </div>

              {/* 配置项 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AI_PROVIDER</Label>
                  <Input 
                    value={providerStatus?.provider || "ollama"} 
                    disabled 
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500">在 Worker 环境变量中配置</p>
                </div>
                <div className="space-y-2">
                  <Label>Ollama URL</Label>
                  <Input 
                    value="http://localhost:11434" 
                    disabled 
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500">本地 Ollama 服务地址</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>默认模型</Label>
                  <Input 
                    value="qwen2.5:14b" 
                    disabled 
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500">当前使用的默认模型</p>
                </div>
                <div className="space-y-2">
                  <Label>超时时间</Label>
                  <Input 
                    value="300s" 
                    disabled 
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500">请求超时时间</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-violet-500" />
                <CardTitle>生成参数</CardTitle>
              </div>
              <CardDescription>配置 AI 生成内容的参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input 
                    type="number" 
                    defaultValue={0.7} 
                    min={0} 
                    max={2} 
                    step={0.1}
                  />
                  <p className="text-xs text-slate-500">控制生成内容的随机性</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input 
                    type="number" 
                    defaultValue={4096} 
                    min={256} 
                    max={8192} 
                    step={256}
                  />
                  <p className="text-xs text-slate-500">最大生成 token 数</p>
                </div>
                <div className="space-y-2">
                  <Label>Top P</Label>
                  <Input 
                    type="number" 
                    defaultValue={0.9} 
                    min={0} 
                    max={1} 
                    step={0.1}
                  />
                  <p className="text-xs text-slate-500">核采样参数</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompt 模板 */}
        <TabsContent value="prompts" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {promptTemplates.map((template) => {
                const desc = promptDescriptions[template.key] || {
                  title: template.key,
                  description: "",
                  icon: <FileText className="h-4 w-4" />,
                };
                const isSaving = savingKeys.has(template.key);
                const isSaved = savedKeys.has(template.key);
                const hasChange = hasChanges(template.key);

                return (
                  <Card key={template.key}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-brand-100 text-brand-600">
                            {desc.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base">{desc.title}</CardTitle>
                            <CardDescription>{desc.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasChange && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                              已修改
                            </Badge>
                          )}
                          {isSaved && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              已保存
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleSaveTemplate(template.key)}
                            disabled={isSaving || !hasChange}
                          >
                            {isSaving ? (
                              <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            保存
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={editedTemplates[template.key] || ""}
                        onChange={(e) => handleTemplateChange(template.key, e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                        placeholder={`请输入 ${desc.title} 的 Prompt 模板...`}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 系统设置 */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-500" />
                <CardTitle>平台配置</CardTitle>
              </div>
              <CardDescription>配置支持的平台和默认设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {["juejin", "zhihu", "xiaohongshu", "wechat", "csdn"].map((platform) => (
                  <div key={platform} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {platform === "juejin" && "🔥"}
                        {platform === "zhihu" && "💡"}
                        {platform === "xiaohongshu" && "📕"}
                        {platform === "wechat" && "💬"}
                        {platform === "csdn" && "💻"}
                      </span>
                      <span className="font-medium">
                        {platform === "juejin" && "掘金"}
                        {platform === "zhihu" && "知乎"}
                        {platform === "xiaohongshu" && "小红书"}
                        {platform === "wechat" && "公众号"}
                        {platform === "csdn" && "CSDN"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch id={`${platform}-enabled`} defaultChecked />
                        <Label htmlFor={`${platform}-enabled`} className="text-sm">启用</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-500" />
                <CardTitle>存储配置</CardTitle>
              </div>
              <CardDescription>配置数据存储和缓存策略</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>数据库</Label>
                  <Input value="D1 (SQLite)" disabled className="bg-slate-50" />
                  <p className="text-xs text-slate-500">Cloudflare D1 数据库</p>
                </div>
                <div className="space-y-2">
                  <Label>缓存</Label>
                  <Input value="KV" disabled className="bg-slate-50" />
                  <p className="text-xs text-slate-500">Cloudflare KV 存储</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>文件存储</Label>
                <Input value="R2" disabled className="bg-slate-50" />
                <p className="text-xs text-slate-500">Cloudflare R2 对象存储</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-red-500" />
                <CardTitle>安全设置</CardTitle>
              </div>
              <CardDescription>配置 API 密钥和安全策略</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>API 密钥</Label>
                <div className="flex gap-2">
                  <Input 
                    type="password" 
                    value="************************" 
                    disabled 
                    className="bg-slate-50 flex-1"
                  />
                  <Button variant="outline" size="sm">
                    重新生成
                  </Button>
                </div>
                <p className="text-xs text-slate-500">用于 API 访问鉴权</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="audit-log" defaultChecked />
                <Label htmlFor="audit-log">启用操作审计日志</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
