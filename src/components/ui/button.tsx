import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "soft";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "xs";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
	{
		variants: {
			variant: {
				default: "border border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-700",
				secondary: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50",
				outline: "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
				ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
				destructive: "border border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-700",
				gradient: "border border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-700",
				soft: "border border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100",
			},
			size: {
				default: "h-10 px-4",
				xs: "h-7 rounded-lg px-2.5 text-[11px]",
				sm: "h-9 px-3.5 text-xs",
				lg: "h-12 px-8 text-base",
				icon: "h-10 w-10 rounded-xl",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
