import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlatformPublishSettingsPanel } from "@/react-app/components/PlatformPublishSettingsPanel";
import type { PlatformPublishSettingsMap, PublishablePlatformType } from "@/shared/types";

interface PlatformPublishSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialPlatform?: PublishablePlatformType;
	initialSettings?: PlatformPublishSettingsMap;
	persist?: boolean;
	onSaved?: (settings: PlatformPublishSettingsMap) => void;
}

export function PlatformPublishSettingsDialog({
	open,
	onOpenChange,
	initialPlatform,
	initialSettings,
	persist = true,
	onSaved,
}: PlatformPublishSettingsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[88vh] max-w-6xl flex-col overflow-hidden">
				<DialogHeader>
					<DialogTitle>{persist ? "平台发布设置" : "本次发布设置"}</DialogTitle>
					<DialogDescription>
						{persist
							? "这里的配置会保存为全局默认值，并同步影响后续发布任务。"
							: "这里会继承全局默认值，但只影响当前这一次发布任务，不会反向修改全局设置。"}
					</DialogDescription>
				</DialogHeader>
				<div className="overflow-y-auto pr-1">
					<PlatformPublishSettingsPanel
						initialPlatform={initialPlatform}
						initialSettings={initialSettings}
						persist={persist}
						onSaved={onSaved}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
