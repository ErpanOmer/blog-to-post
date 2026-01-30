import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "soft";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "xs";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
	{
		variants: {
			variant: {
				default: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow-md",
				secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200/50",
				outline: "border-2 border-slate-200 bg-white/80 hover:bg-slate-50 hover:border-slate-300 backdrop-blur-sm",
				ghost: "hover:bg-slate-100/80 text-slate-700 hover:text-slate-900",
				destructive: "bg-red-600 text-white hover:bg-red-500 shadow-sm hover:shadow-md",
				gradient: "bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:from-brand-700 hover:to-violet-700 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 border-0",
				soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200/50",
			},
			size: {
				default: "h-10 px-5",
				xs: "h-7 px-2.5 text-xs rounded-lg",
				sm: "h-9 px-4 text-xs",
				lg: "h-12 px-8 text-base",
				icon: "h-10 w-10",
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
