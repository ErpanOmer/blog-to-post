import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
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
		logoClass: "bg-gradient-to-br from-sky-500 to-blue-600",
		logoTextClass: "text-white",
		ringClass: "ring-sky-100",
	},
	zhihu: {
		label: PLATFORM_DISPLAY_NAMES.zhihu,
		shortName: PLATFORM_SHORT_ICONS.zhihu,
		textClass: "text-blue-700",
		softClass: "bg-blue-50 text-blue-700 border-blue-200/70",
		badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
		logoClass: "bg-gradient-to-br from-blue-500 to-indigo-600",
		logoTextClass: "text-white",
		ringClass: "ring-blue-100",
	},
	wechat: {
		label: PLATFORM_DISPLAY_NAMES.wechat,
		shortName: PLATFORM_SHORT_ICONS.wechat,
		textClass: "text-emerald-700",
		softClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
		badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
		logoClass: "bg-gradient-to-br from-emerald-500 to-green-600",
		logoTextClass: "text-white",
		ringClass: "ring-emerald-100",
	},
	csdn: {
		label: PLATFORM_DISPLAY_NAMES.csdn,
		shortName: PLATFORM_SHORT_ICONS.csdn,
		textClass: "text-rose-700",
		softClass: "bg-rose-50 text-rose-700 border-rose-200/70",
		badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
		logoClass: "bg-gradient-to-br from-red-500 to-rose-600",
		logoTextClass: "text-white",
		ringClass: "ring-rose-100",
	},
	cnblogs: {
		label: PLATFORM_DISPLAY_NAMES.cnblogs,
		shortName: PLATFORM_SHORT_ICONS.cnblogs,
		textClass: "text-indigo-700",
		softClass: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
		badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
		logoClass: "bg-gradient-to-br from-indigo-500 to-violet-600",
		logoTextClass: "text-white",
		ringClass: "ring-indigo-100",
	},
	segmentfault: {
		label: PLATFORM_DISPLAY_NAMES.segmentfault,
		shortName: PLATFORM_SHORT_ICONS.segmentfault,
		textClass: "text-teal-700",
		softClass: "bg-teal-50 text-teal-700 border-teal-200/70",
		badgeClass: "border-teal-200 bg-teal-50 text-teal-700",
		logoClass: "bg-gradient-to-br from-teal-500 to-emerald-600",
		logoTextClass: "text-white",
		ringClass: "ring-teal-100",
	},
	website: {
		label: PLATFORM_DISPLAY_NAMES.website,
		shortName: PLATFORM_SHORT_ICONS.website,
		textClass: "text-orange-700",
		softClass: "bg-orange-50 text-orange-700 border-orange-200/70",
		badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
		logoClass: "bg-gradient-to-br from-orange-500 to-amber-500",
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

type PlatformLogoProps = HTMLAttributes<HTMLSpanElement> & {
	platform: PlatformType | string;
	size?: "xs" | "sm" | "md" | "lg";
};

const logoSizeClass = {
	xs: "h-4 w-4 text-[9px] rounded-md",
	sm: "h-6 w-6 text-[11px] rounded-lg",
	md: "h-8 w-8 text-xs rounded-xl",
	lg: "h-10 w-10 text-sm rounded-2xl",
};

export function PlatformLogo({ platform, size = "sm", className, ...props }: PlatformLogoProps) {
	const brand = getPlatformBrand(platform);
	const shortName = getPlatformShortName(platform);
	const ariaLabel = props["aria-label"];

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center font-black tracking-tight shadow-sm ring-4",
				logoSizeClass[size],
				brand?.logoClass ?? "bg-gradient-to-br from-slate-500 to-slate-700",
				brand?.logoTextClass ?? "text-white",
				brand?.ringClass ?? "ring-slate-100",
				className,
			)}
			aria-hidden={ariaLabel ? undefined : true}
			aria-label={ariaLabel}
			{...props}
		>
			{shortName}
		</span>
	);
}

type PlatformBadgeProps = HTMLAttributes<HTMLSpanElement> & {
	platform: PlatformType | string;
	showLabel?: boolean;
	size?: "xs" | "sm" | "md";
	withLogo?: boolean;
};

const badgeSizeClass = {
	xs: "gap-1 px-1.5 py-0.5 text-[10px]",
	sm: "gap-1.5 px-2 py-0.5 text-[11px]",
	md: "gap-2 px-2.5 py-1 text-xs",
};

export function PlatformBadge({
	platform,
	showLabel = true,
	size = "sm",
	withLogo = true,
	className,
	...props
}: PlatformBadgeProps) {
	const brand = getPlatformBrand(platform);

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full border font-semibold leading-none",
				badgeSizeClass[size],
				brand?.badgeClass ?? "border-slate-200 bg-slate-50 text-slate-600",
				className,
			)}
			{...props}
		>
			{withLogo ? <PlatformLogo platform={platform} size={size === "md" ? "sm" : "xs"} className="ring-0 shadow-none" /> : null}
			{showLabel ? <span>{getPlatformDisplayName(platform)}</span> : null}
		</span>
	);
}
