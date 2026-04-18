import { cva } from "class-variance-authority";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "soft";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "xs";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
	{
		variants: {
			variant: {
				default: "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/20 hover:shadow-md hover:shadow-brand-500/25 hover:brightness-110",
				secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300",
				outline: "border border-slate-200 bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
				ghost: "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
				destructive: "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-500/20 hover:shadow-md hover:shadow-red-500/25 hover:brightness-110",
				gradient: "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/20 hover:shadow-md hover:shadow-brand-500/25 hover:brightness-110",
				soft: "bg-brand-50 text-brand-700 hover:bg-brand-100/80",
			},
			size: {
				default: "h-9 px-4",
				xs: "h-7 rounded-md px-2.5 text-[11px]",
				sm: "h-8 px-3 text-xs",
				lg: "h-11 px-6 text-base rounded-xl",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);
