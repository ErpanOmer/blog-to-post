import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium transition-colors focus:outline-none focus:ring-[3px] focus:ring-brand-500/10",
	{
		variants: {
			variant: {
				default: "border-brand-200 bg-brand-50 text-brand-700",
				secondary: "border-design-border bg-design-background text-design-textSecondary",
				destructive: "border-red-200 bg-red-50 text-red-700",
				outline: "border-design-border bg-white text-design-textSecondary",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "secondary" | "destructive" | "outline";
}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge };
