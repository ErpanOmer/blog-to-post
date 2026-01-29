import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
	return (
		<section className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
			<div className="mb-4">
				<h2 className="text-lg font-semibold text-slate-900">{title}</h2>
				{description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
			</div>
			{children}
		</section>
	);
}
