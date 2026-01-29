import type { Article, PlatformType } from "../types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function DistributionPanel({ article, selectedPlatforms, onToggle, onPublish, onSchedule }: {
	article: Article | null;
	selectedPlatforms: PlatformType[];
	onToggle: (platform: PlatformType) => void;
	onPublish: () => void;
	onSchedule: () => void;
}) {
	const options: { value: PlatformType; label: string }[] = [
		{ value: "juejin", label: "掘金" },
		{ value: "zhihu", label: "知乎" },
		{ value: "xiaohongshu", label: "小红书" },
		{ value: "wechat", label: "公众号" },
	];

	return (
		<div className="space-y-4">
			<div className="space-y-3">
				{options.map((option) => (
					<div key={option.value} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
						<div>
							<p className="text-sm font-semibold text-slate-900">{option.label}</p>
							<p className="text-xs text-slate-500">适配内容将自动生成并存入发布队列</p>
						</div>
						<Switch checked={selectedPlatforms.includes(option.value)} onCheckedChange={() => onToggle(option.value)} />
					</div>
				))}
			</div>
			<div className="flex flex-wrap gap-3">
				<Button onClick={onPublish} disabled={!article} type="button">立即发布</Button>
				<Button variant="secondary" onClick={onSchedule} disabled={!article} type="button">加入定时发布</Button>
			</div>
		</div>
	);
}
