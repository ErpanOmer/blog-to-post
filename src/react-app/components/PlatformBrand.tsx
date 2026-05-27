import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { PlatformType } from "@/shared/types";
import { getPlatformBrand, getPlatformDisplayName, getPlatformShortName } from "@/react-app/components/platform-brand-data";

type PlatformLogoProps = HTMLAttributes<HTMLSpanElement> & {
	platform: PlatformType | string;
	size?: "xs" | "sm" | "md" | "lg";
};

const logoSizeClass = {
	xs: "h-4 w-4 text-[9px] rounded-md",
	sm: "h-6 w-6 text-[11px] rounded-lg",
	md: "h-8 w-8 text-[12px] rounded-xl",
	lg: "h-10 w-10 text-[13px] rounded-xl",
};

export function PlatformLogo({ platform, size = "sm", className, ...props }: PlatformLogoProps) {
	const brand = getPlatformBrand(platform);
	const shortName = getPlatformShortName(platform);
	const ariaLabel = props["aria-label"];

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center font-black tracking-normal ring-4",
				logoSizeClass[size],
				brand?.logoClass ?? "bg-design-textSecondary",
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
	md: "gap-2 px-2.5 py-1 text-[12px]",
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
				brand?.badgeClass ?? "border-design-border bg-design-background text-design-textSecondary",
				className,
			)}
			{...props}
		>
			{withLogo ? <PlatformLogo platform={platform} size={size === "md" ? "sm" : "xs"} className="ring-0 shadow-none" /> : null}
			{showLabel ? <span>{getPlatformDisplayName(platform)}</span> : null}
		</span>
	);
}
