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
        "surface-panel p-6",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {icon && <div className="icon-tile h-10 w-10 flex-shrink-0">{icon}</div>}
          <div>
            <p className="eyebrow-label mb-2">Workspace Module</p>
            <h2 className="text-xl font-semibold leading-tight text-slate-900">{title}</h2>
            {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
          </div>
        </div>
        {action && <div className="flex-shrink-0 self-start">{action}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
