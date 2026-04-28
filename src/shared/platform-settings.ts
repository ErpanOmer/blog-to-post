import type {
	PlatformPublishSetting,
	PlatformPublishSettingsMap,
	PublishablePlatformType,
} from "./types";

export const PUBLISHABLE_PLATFORMS = [
	"juejin",
	"zhihu",
	"wechat",
	"csdn",
	"cnblogs",
	"segmentfault",
] as const satisfies readonly PublishablePlatformType[];

export const PLATFORM_DISPLAY_NAMES: Record<PublishablePlatformType, string> = {
	juejin: "掘金",
	zhihu: "知乎",
	wechat: "公众号",
	csdn: "CSDN",
	cnblogs: "博客园",
	segmentfault: "SegmentFault",
};

export const PLATFORM_SHORT_ICONS: Record<PublishablePlatformType, string> = {
	juejin: "J",
	zhihu: "Z",
	wechat: "W",
	csdn: "C",
	cnblogs: "B",
	segmentfault: "S",
};

export function createDefaultPlatformPublishSetting(
	platform: PublishablePlatformType,
): PlatformPublishSetting {
	return {
		platform,
		enabled: true,
		draftOnly: true,
		useCoverImageAsHeader: false,
		headerSlot: "",
		footerSlot: "",
	};
}

export function createDefaultPlatformPublishSettings(): PlatformPublishSettingsMap {
	return PUBLISHABLE_PLATFORMS.reduce((acc, platform) => {
		acc[platform] = createDefaultPlatformPublishSetting(platform);
		return acc;
	}, {} as PlatformPublishSettingsMap);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

export function normalizePlatformPublishSettings(input?: unknown): PlatformPublishSettingsMap {
	const defaults = createDefaultPlatformPublishSettings();
	if (!input || typeof input !== "object") return defaults;

	const source = input as Record<string, Partial<PlatformPublishSetting> | undefined>;
	for (const platform of PUBLISHABLE_PLATFORMS) {
		const current = source[platform];
		if (!current || typeof current !== "object") continue;

		defaults[platform] = {
			platform,
			enabled: normalizeBoolean(current.enabled, true),
			draftOnly: normalizeBoolean(current.draftOnly, true),
			useCoverImageAsHeader: normalizeBoolean(current.useCoverImageAsHeader, false),
			headerSlot: normalizeString(current.headerSlot),
			footerSlot: normalizeString(current.footerSlot),
		};
	}

	return defaults;
}

export function isPublishablePlatform(value: string): value is PublishablePlatformType {
	return (PUBLISHABLE_PLATFORMS as readonly string[]).includes(value);
}
