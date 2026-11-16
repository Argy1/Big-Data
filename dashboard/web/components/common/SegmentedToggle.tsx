"use client";

import { cn } from "@/lib/utils";

/**
 * Group of toggle buttons with aria-pressed (PLAN §10.2).
 * variant "accent" (horizon): active = accent background. "raised" (3D/2D): active = raised + shadow.
 */
export function SegmentedToggle<T extends string | number>({
  label,
  options,
  value,
  onChange,
  variant = "accent",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: "accent" | "raised";
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-border bg-bg p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold whitespace-nowrap",
              variant === "accent" && (active ? "bg-accent text-on-accent" : "text-text-2 hover:text-text"),
              variant === "raised" &&
                (active ? "bg-raised text-text shadow-[0_1px_2px_rgba(15,23,34,0.12)]" : "text-muted hover:text-text"),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
