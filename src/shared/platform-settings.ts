import type {
	PlatformPublishSetting,
	PlatformPublishSettingsMap,
	PlatformType,
	PublishablePlatformType,
} from "./types";

export const PUBLISHABLE_PLATFORMS = [
	"juejin",
	"zhihu",
	"wechat",
	"wechat_v2",
	"csdn",
	"cnblogs",
	"segmentfault",
	"51cto",
	"website",
] as const satisfies readonly PublishablePlatformType[];

export const PLATFORM_DISPLAY_NAMES: Record<PublishablePlatformType, string> = {
	juejin: "掘金",
	zhihu: "知乎",
	wechat: "公众号",
	wechat_v2: "公众号V2",
	csdn: "CSDN",
	cnblogs: "博客园",
	segmentfault: "SegmentFault",
	"51cto": "51CTO",
	website: "个人网站",
};

export const PLATFORM_SHORT_ICONS: Record<PublishablePlatformType, string> = {
	juejin: "J",
	zhihu: "Z",
	wechat: "W",
	wechat_v2: "W2",
	csdn: "C",
	cnblogs: "B",
	segmentfault: "S",
	"51cto": "51",
	website: "站",
};

// Both platforms share the appId/appSecret credential form and the WeChat-specific
// publish behaviors; wechat_v2 only routes API calls through the fixed-egress relay.
export function isWechatFamilyPlatform(platform: PlatformType | string): platform is "wechat" | "wechat_v2" {
	return platform === "wechat" || platform === "wechat_v2";
}

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
