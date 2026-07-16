import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FlaskConical, KeyRound, Loader2, Save, Server } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	createAIProviderProfile,
	getAIModelRouting,
	getAIProviderProfiles,
	testAIProviderProfile,
	testUnsavedAIProviderProfile,
	updateAIModelRouting,
	updateAIProviderProfile,
} from "@/react-app/api";
import type { AIProviderProfileSummary, AIProviderProtocol } from "@/shared/types";

interface GlobalAIForm {
	protocol: AIProviderProtocol;
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	requestTimeoutSec: number;
}

interface ConfigurationNotice {
	kind: "success" | "error";
	message: string;
}

const DEFAULT_FORM: GlobalAIForm = {
	protocol: "openai-compatible",
	baseUrl: "https://api.deepseek.com",
	apiKey: "",
	model: "",
	temperature: 0.7,
	topP: 0.9,
	maxTokens: 4096,
	requestTimeoutSec: 120,
};

function errorMessage(error: unknown, fallback: string): string {
	const message = error instanceof Error ? error.message : fallback;
	if (message.includes("ENCRYPTION_KEY")) {
		return "无法保存 API Key：请先在本地 .env 或 Cloudflare Worker Secret 中配置 64 位十六进制 ENCRYPTION_KEY，然后重启服务。";
	}
	return message;
}

export function AIConfigurationPanel() {
	const [configuration, setConfiguration] = useState<AIProviderProfileSummary | null>(null);
	const [form, setForm] = useState<GlobalAIForm>(DEFAULT_FORM);
	const [isLoading, setIsLoading] = useState(true);
	const [busyAction, setBusyAction] = useState<"save" | "test" | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [notice, setNotice] = useState<ConfigurationNotice | null>(null);

	const loadConfiguration = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			const [configurations, routing] = await Promise.all([
				getAIProviderProfiles(),
				getAIModelRouting(),
			]);
			const selected = routing.defaultRoute
				? configurations.find((item) => item.id === routing.defaultRoute?.providerId) ?? null
				: configurations[0] ?? null;
			setConfiguration(selected);
			if (selected) {
				setForm({
					protocol: selected.protocol,
					baseUrl: selected.baseUrl,
					apiKey: "",
					model: routing.defaultRoute?.providerId === selected.id
						? routing.defaultRoute.model
						: selected.defaultModel,
					temperature: routing.defaultRoute?.temperature ?? DEFAULT_FORM.temperature,
					topP: routing.defaultRoute?.topP ?? DEFAULT_FORM.topP,
					maxTokens: routing.defaultRoute?.maxTokens ?? DEFAULT_FORM.maxTokens,
					requestTimeoutSec: routing.defaultRoute?.requestTimeoutSec ?? DEFAULT_FORM.requestTimeoutSec,
				});
			} else {
				setForm(DEFAULT_FORM);
			}
		} catch (error) {
			setLoadError(errorMessage(error, "加载全局 AI 配置失败"));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadConfiguration();
	}, [loadConfiguration]);

	const validate = (): string | null => {
		if (!form.baseUrl.trim()) return "请填写 Base URL";
		if (!form.model.trim()) return "请填写全局模型 ID";
		if (!Number.isFinite(form.temperature) || form.temperature < 0 || form.temperature > 2) return "Temperature 必须在 0–2 之间";
		if (!Number.isFinite(form.topP) || form.topP < 0 || form.topP > 1) return "Top P 必须在 0–1 之间";
		if (!Number.isFinite(form.maxTokens) || form.maxTokens < 1) return "Max tokens 必须大于 0";
		if (!Number.isFinite(form.requestTimeoutSec) || form.requestTimeoutSec < 5) return "超时时间不能少于 5 秒";
		return null;
	};

	const saveConfiguration = async () => {
		const validationError = validate();
		if (validationError) {
			setNotice({ kind: "error", message: validationError });
			toast.error(validationError);
			return;
		}

		setBusyAction("save");
		setNotice(null);
		try {
			const payload = {
				name: configuration?.name ?? "全局 AI 配置",
				protocol: form.protocol,
				baseUrl: form.baseUrl.trim(),
				apiKey: form.apiKey.trim() || undefined,
				defaultModel: form.model.trim(),
				enabled: true,
			};
			const saved = configuration
				? await updateAIProviderProfile(configuration.id, payload)
				: await createAIProviderProfile(payload);
			await updateAIModelRouting([{
				feature: "default",
				providerId: saved.id,
				model: form.model.trim(),
				temperature: form.temperature,
				topP: form.topP,
				maxTokens: form.maxTokens,
				requestTimeoutSec: form.requestTimeoutSec,
			}]);
			setConfiguration(saved);
			setForm((current) => ({ ...current, apiKey: "" }));
			const message = "全局 AI 配置已保存，所有 AI 功能将统一使用该模型";
			setNotice({ kind: "success", message });
			toast.success(message);
		} catch (error) {
			const message = errorMessage(error, "保存全局 AI 配置失败");
			setNotice({ kind: "error", message });
			toast.error(message);
		} finally {
			setBusyAction(null);
		}
	};

	const testConnection = async () => {
		const validationError = validate();
		if (validationError) {
			setNotice({ kind: "error", message: validationError });
			toast.error(validationError);
			return;
		}
		setBusyAction("test");
		setNotice(null);
		try {
			const savedConnectionUnchanged = Boolean(
				configuration
				&& !form.apiKey.trim()
				&& configuration.protocol === form.protocol
				&& configuration.baseUrl.replace(/\/$/, "") === form.baseUrl.trim().replace(/\/$/, "")
				&& configuration.defaultModel === form.model.trim(),
			);
			if (configuration && !form.apiKey.trim() && !savedConnectionUnchanged) {
				throw new Error("接口地址、协议或模型已经修改；请先保存全局 AI 配置，再测试连接。若要更换 API Key，请同时填写新 Key。");
			}
			const result = savedConnectionUnchanged && configuration
				? await testAIProviderProfile(configuration.id)
				: await testUnsavedAIProviderProfile({
					name: "全局 AI 配置",
					protocol: form.protocol,
					baseUrl: form.baseUrl.trim(),
					apiKey: form.apiKey.trim() || undefined,
					defaultModel: form.model.trim(),
					enabled: true,
				});
			const message = result.message?.trim() || "连接测试成功，模型已正常返回响应";
			setNotice({ kind: "success", message });
			toast.success(message);
		} catch (error) {
			const message = errorMessage(error, "连接测试失败");
			setNotice({ kind: "error", message });
			toast.error(message);
		} finally {
			setBusyAction(null);
		}
	};

	if (isLoading) {
		return <div className="flex min-h-40 items-center justify-center rounded-lg border border-design-border bg-white"><Loader2 className="h-5 w-5 animate-spin text-design-neutral" /></div>;
	}

	if (loadError) {
		return (
			<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
				<p>{loadError}</p>
				<Button variant="outline" size="sm" className="mt-3" onClick={() => void loadConfiguration()}>重试</Button>
			</div>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4 text-brand-500" />全局 AI 配置</CardTitle>
						<CardDescription className="mt-1">整个工作台只运行这一套 AI 接口和全局模型；文章局部设置只覆盖 Temperature、Top P 与 Prompt。</CardDescription>
					</div>
					<Badge variant={configuration?.lastVerificationStatus === "success" ? "outline" : "secondary"} className={configuration?.lastVerificationStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
						{configuration?.lastVerificationStatus === "success" ? "连接正常" : configuration ? "已配置" : "未配置"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1.5">
						<Label>接口协议</Label>
						<Select value={form.protocol} onValueChange={(protocol) => setForm((current) => ({ ...current, protocol: protocol as AIProviderProtocol }))}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent><SelectItem value="openai-compatible">OpenAI-compatible</SelectItem><SelectItem value="anthropic">Anthropic</SelectItem></SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>全局模型 ID</Label>
						<Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="例如 deepseek-v4-pro" />
					</div>
					<div className="space-y-1.5 md:col-span-2">
						<Label>Base URL</Label>
						<Input value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com/v1" />
					</div>
					<div className="space-y-1.5 md:col-span-2">
						<div className="flex items-center justify-between gap-3"><Label>API Key</Label>{configuration?.hasApiKey ? <span className="inline-flex items-center gap-1 text-[12px] text-emerald-600"><KeyRound className="h-3 w-3" />已安全保存；留空表示保留</span> : null}</div>
						<Input type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={configuration?.hasApiKey ? "已配置；留空保留原 Key" : "输入 API Key；无密钥的本地接口可留空"} />
					</div>
				</div>

				<div className="border-t border-design-border pt-4">
					<p className="mb-3 text-[13px] font-medium text-design-text">全局生成参数</p>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="space-y-1.5"><Label>Temperature</Label><Input type="number" min={0} max={2} step={0.05} value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: Number(event.target.value) }))} /></div>
						<div className="space-y-1.5"><Label>Top P</Label><Input type="number" min={0} max={1} step={0.05} value={form.topP} onChange={(event) => setForm((current) => ({ ...current, topP: Number(event.target.value) }))} /></div>
						<div className="space-y-1.5"><Label>Max tokens</Label><Input type="number" min={1} value={form.maxTokens} onChange={(event) => setForm((current) => ({ ...current, maxTokens: Number(event.target.value) }))} /></div>
						<div className="space-y-1.5"><Label>超时（秒）</Label><Input type="number" min={5} max={600} value={form.requestTimeoutSec} onChange={(event) => setForm((current) => ({ ...current, requestTimeoutSec: Number(event.target.value) }))} /></div>
					</div>
				</div>

				{notice ? (
					<div role="status" aria-live="polite" className={`flex items-start gap-2 rounded-lg border p-3 text-[13px] leading-5 ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
						{notice.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
						<p className="min-w-0 break-words">{notice.message}</p>
					</div>
				) : null}

				<div className="flex flex-wrap justify-end gap-2">
					<Button variant="outline" onClick={() => void testConnection()} disabled={Boolean(busyAction)}>{busyAction === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}测试连接</Button>
					<Button onClick={() => void saveConfiguration()} disabled={Boolean(busyAction)}>{busyAction === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存全局配置</Button>
				</div>
			</CardContent>
		</Card>
	);
}
