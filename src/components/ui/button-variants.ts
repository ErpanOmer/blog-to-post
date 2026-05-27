import { cva } from "class-variance-authority";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "soft";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "xs";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/10 disabled:pointer-events-none disabled:opacity-50 active:translate-y-0",
	{
		variants: {
			variant: {
				default: "bg-brand-500 text-white hover:-translate-y-px hover:bg-brand-600 hover:shadow-glow",
				secondary: "border border-design-border bg-white text-design-textSecondary hover:-translate-y-px hover:border-slate-300 hover:bg-design-background",
				outline: "border border-design-border bg-transparent text-design-textSecondary hover:-translate-y-px hover:bg-design-background hover:text-design-text",
				ghost: "text-design-textSecondary hover:bg-design-background hover:text-design-text",
				destructive: "border border-red-200 bg-white text-red-600 hover:-translate-y-px hover:bg-red-50",
				gradient: "bg-brand-500 text-white hover:-translate-y-px hover:bg-brand-600 hover:shadow-glow",
				soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
			},
			size: {
				default: "h-[38px] px-4",
				xs: "h-7 px-2.5 text-[11px]",
				sm: "h-8 px-3 text-xs",
				lg: "h-11 px-6 text-base",
				icon: "h-[38px] w-[38px]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);
