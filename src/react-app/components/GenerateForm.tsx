import type { PlatformType } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function GenerateForm({ value, onChange, onSubmit, isLoading = false }: {
	value: { title: string; outline: string; platform: PlatformType; tone: "technical" | "casual" | "marketing"; length: "short" | "medium" | "long" };
	onChange: (next: typeof value) => void;
	onSubmit: () => void;
	isLoading?: boolean;
}) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">标题</label>
				<Input value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} />
			</div>
			<div className="space-y-2">
				<label className="text-xs font-semibold text-slate-500">大纲（可选）</label>
				<Textarea value={value.outline} onChange={(event) => onChange({ ...value, outline: event.target.value })} />
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-500">平台</label>
					<Select value={value.platform} onValueChange={(platform) => onChange({ ...value, platform: platform as PlatformType })}>
						<SelectTrigger>
							<SelectValue placeholder="选择平台" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="juejin">掘金</SelectItem>
							<SelectItem value="zhihu">知乎</SelectItem>
							<SelectItem value="xiaohongshu">小红书</SelectItem>
							<SelectItem value="wechat">公众号</SelectItem>
						</SelectContent>
					</Select>
				</div>
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
