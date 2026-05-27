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
        "rounded-xl border border-design-border bg-white p-5 page-enter",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          {icon && <div className="icon-tile h-8 w-8 flex-shrink-0">{icon}</div>}
          <div>
            <h2 className="font-display text-base font-semibold text-design-text">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-design-textSecondary">{description}</p> : null}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
