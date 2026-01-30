import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
	icon?: ReactNode;
	action?: ReactNode;
}

export function SectionCard({ title, description, children, className, icon, action }: SectionCardProps) {
	return (
		<section
			className={cn(
				"group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-card backdrop-blur-sm",
				"transition-all duration-300 hover:shadow-card-hover hover:border-slate-300/60",
				className
			)}
		>
			{/* Subtle gradient overlay */}
			<div className="absolute inset-0 bg-gradient-to-br from-brand-50/30 via-transparent to-violet-50/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

			<div className="relative">
				<div className="mb-5 flex items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						{icon && (
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/25">
								{icon}
							</div>
						)}
						<div>
							<h2 className="text-lg font-bold text-slate-900">{title}</h2>
							{description ? (
								<p className="mt-0.5 text-sm text-slate-500">{description}</p>
							) : null}
						</div>
					</div>
					{action && <div className="flex-shrink-0">{action}</div>}
				</div>
				<div className="relative">{children}</div>
			</div>
		</section>
	);
}
