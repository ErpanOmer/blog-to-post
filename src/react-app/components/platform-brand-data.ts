import type { PlatformType, PublishablePlatformType } from "@/shared/types";
import { PLATFORM_DISPLAY_NAMES, PLATFORM_SHORT_ICONS, isPublishablePlatform } from "@/shared/platform-settings";

export type PlatformBrandTone = {
	label: string;
	shortName: string;
	textClass: string;
	softClass: string;
	badgeClass: string;
	logoClass: string;
	logoTextClass: string;
	ringClass: string;
};

export const PLATFORM_BRANDS: Record<PublishablePlatformType, PlatformBrandTone> = {
	juejin: {
		label: PLATFORM_DISPLAY_NAMES.juejin,
		shortName: PLATFORM_SHORT_ICONS.juejin,
		textClass: "text-sky-700",
		softClass: "bg-sky-50 text-sky-700 border-sky-200/70",
		badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
		logoClass: "bg-sky-500",
		logoTextClass: "text-white",
		ringClass: "ring-sky-100",
	},
	zhihu: {
		label: PLATFORM_DISPLAY_NAMES.zhihu,
		shortName: PLATFORM_SHORT_ICONS.zhihu,
		textClass: "text-blue-700",
		softClass: "bg-blue-50 text-blue-700 border-blue-200/70",
		badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
		logoClass: "bg-blue-500",
		logoTextClass: "text-white",
		ringClass: "ring-blue-100",
	},
	wechat: {
		label: PLATFORM_DISPLAY_NAMES.wechat,
		shortName: PLATFORM_SHORT_ICONS.wechat,
		textClass: "text-emerald-700",
		softClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
		badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
		logoClass: "bg-emerald-500",
		logoTextClass: "text-white",
		ringClass: "ring-emerald-100",
	},
	csdn: {
		label: PLATFORM_DISPLAY_NAMES.csdn,
		shortName: PLATFORM_SHORT_ICONS.csdn,
		textClass: "text-rose-700",
		softClass: "bg-rose-50 text-rose-700 border-rose-200/70",
		badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
		logoClass: "bg-red-500",
		logoTextClass: "text-white",
		ringClass: "ring-rose-100",
	},
	cnblogs: {
		label: PLATFORM_DISPLAY_NAMES.cnblogs,
		shortName: PLATFORM_SHORT_ICONS.cnblogs,
		textClass: "text-indigo-700",
		softClass: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
		badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
		logoClass: "bg-indigo-500",
		logoTextClass: "text-white",
		ringClass: "ring-indigo-100",
	},
	segmentfault: {
		label: PLATFORM_DISPLAY_NAMES.segmentfault,
		shortName: PLATFORM_SHORT_ICONS.segmentfault,
		textClass: "text-teal-700",
		softClass: "bg-teal-50 text-teal-700 border-teal-200/70",
		badgeClass: "border-teal-200 bg-teal-50 text-teal-700",
		logoClass: "bg-teal-500",
		logoTextClass: "text-white",
		ringClass: "ring-teal-100",
	},
	"51cto": {
		label: PLATFORM_DISPLAY_NAMES["51cto"],
		shortName: PLATFORM_SHORT_ICONS["51cto"],
		textClass: "text-cyan-700",
		softClass: "bg-cyan-50 text-cyan-700 border-cyan-200/70",
		badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
		logoClass: "bg-cyan-500",
		logoTextClass: "text-white",
		ringClass: "ring-cyan-100",
	},
	website: {
		label: PLATFORM_DISPLAY_NAMES.website,
		shortName: PLATFORM_SHORT_ICONS.website,
		textClass: "text-orange-700",
		softClass: "bg-orange-50 text-orange-700 border-orange-200/70",
		badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
		logoClass: "bg-orange-500",
		logoTextClass: "text-white",
		ringClass: "ring-orange-100",
	},
};

export function getPlatformDisplayName(platform: PlatformType | string): string {
	return isPublishablePlatform(platform) ? PLATFORM_BRANDS[platform].label : platform || "未知平台";
}

export function getPlatformShortName(platform: PlatformType | string): string {
	return isPublishablePlatform(platform) ? PLATFORM_BRANDS[platform].shortName : (platform || "?").slice(0, 1).toUpperCase();
}

export function getPlatformBrand(platform: PlatformType | string): PlatformBrandTone | null {
	return isPublishablePlatform(platform) ? PLATFORM_BRANDS[platform] : null;
}
