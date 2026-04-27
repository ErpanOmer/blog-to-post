import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlatformPublishSettingsPanel } from "@/react-app/components/PlatformPublishSettingsPanel";
import type { PlatformPublishSettingsMap, PublishablePlatformType } from "@/shared/types";

interface PlatformPublishSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialPlatform?: PublishablePlatformType;
	onSaved?: (settings: PlatformPublishSettingsMap) => void;
}

export function PlatformPublishSettingsDialog({
	open,
	onOpenChange,
	initialPlatform,
	onSaved,
}: PlatformPublishSettingsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[88vh] max-w-6xl flex-col overflow-hidden">
				<DialogHeader>
					<DialogTitle>平台发布设置</DialogTitle>
					<DialogDescription>
						这里的配置与全局设置同步，保存后会立即影响发布弹窗和后续发布任务。
					</DialogDescription>
				</DialogHeader>
				<div className="overflow-y-auto pr-1">
					<PlatformPublishSettingsPanel initialPlatform={initialPlatform} onSaved={onSaved} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
