import type { PlatformType } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function GenerateForm({ value, onChange, onSubmit, onFetchHot, isLoading = false, isFetching = false }: {
	value: {
		title: string;
		outline: string;
		platform: PlatformType;
		tone: "technical" | "casual" | "marketing";
		length: "short" | "medium" | "long";
		titleSource: "juejin" | "custom";
		sourceTitles: string[];
		customTitles: string;
	};
	onChange: (next: typeof value) => void;
	onSubmit: () => void;
	onFetchHot: () => void;
	isLoading?: boolean;
	isFetching?: boolean;
}) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">标题（可选）</label>
				<Input value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} placeholder="留空则按热门标题生成" />
			</div>
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">标题来源</label>
				<div className="flex flex-wrap gap-2">
					<Button
						variant={value.titleSource === "juejin" ? "default" : "outline"}
						onClick={() => onChange({ ...value, titleSource: "juejin" })}
						type="button"
						size="sm"
					>
						掘金 TOP20
					</Button>
					<Button
						variant={value.titleSource === "custom" ? "default" : "outline"}
						onClick={() => onChange({ ...value, titleSource: "custom" })}
						type="button"
						size="sm"
					>
						自定义标题范围
					</Button>
					<Button variant="secondary" size="sm" onClick={onFetchHot} type="button" disabled={isFetching}>
						{isFetching ? "抓取中..." : "获取热门标题"}
					</Button>
				</div>
			</div>
			{value.titleSource === "custom" ? (
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">自定义标题（每行一个）</label>
					<Textarea value={value.customTitles} onChange={(event) => onChange({ ...value, customTitles: event.target.value })} />
				</div>
			) : (
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">热门标题样本</label>
					<Textarea value={value.sourceTitles.join("\n")} readOnly placeholder="点击获取热门标题" />
				</div>
			)}
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">大纲（可选）</label>
				<Textarea value={value.outline} onChange={(event) => onChange({ ...value, outline: event.target.value })} />
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">语气</label>
					<Select value={value.tone} onValueChange={(tone) => onChange({ ...value, tone: tone as "technical" | "casual" | "marketing" })}>
						<SelectTrigger>
							<SelectValue placeholder="选择语气" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="technical">技术</SelectItem>
							<SelectItem value="casual">口语化</SelectItem>
							<SelectItem value="marketing">营销</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">长度</label>
					<Select value={value.length} onValueChange={(length) => onChange({ ...value, length: length as "short" | "medium" | "long" })}>
						<SelectTrigger>
							<SelectValue placeholder="选择长度" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="short">短</SelectItem>
							<SelectItem value="medium">中</SelectItem>
							<SelectItem value="long">长</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Button onClick={onSubmit} type="button" disabled={isLoading}>
				{isLoading ? "生成中..." : "生成草稿"}
			</Button>
		</div>
	);
}

