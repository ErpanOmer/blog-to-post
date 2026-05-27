import type { Article, PlatformType } from "@/react-app/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PlatformLogo } from "@/react-app/components/PlatformBrand";
import { getPlatformDisplayName } from "@/react-app/components/platform-brand-data";
import { PUBLISHABLE_PLATFORMS } from "@/shared/platform-settings";

export function DistributionPanel({ article, selectedPlatforms, onToggle, onPublish, onSchedule }: {
	article: Article | null;
	selectedPlatforms: PlatformType[];
	onToggle: (platform: PlatformType) => void;
	onPublish: () => void;
	onSchedule: () => void;
}) {
	const options: PlatformType[] = [...PUBLISHABLE_PLATFORMS];

	return (
		<div className="space-y-4">
			<div className="space-y-3">
				{options.map((platform) => (
					<div key={platform} className="flex items-center justify-between rounded-lg border border-design-border bg-white px-4 py-3">
						<div className="flex items-center gap-3">
							<PlatformLogo platform={platform} size="md" />
							<div>
								<p className="text-[13px] font-semibold text-design-text">{getPlatformDisplayName(platform)}</p>
								<p className="text-[12px] text-design-textSecondary">适配内容会自动生成并写入发布队列</p>
							</div>
						</div>
						<Switch checked={selectedPlatforms.includes(platform)} onCheckedChange={() => onToggle(platform)} />
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
