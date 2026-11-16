"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Plain <button> with visible text, so no aria-label needed (PLAN §9.1).
 * Both labels are rendered and CSS shows the right one from <html data-theme>,
 * which next-themes sets before hydration: no flash and no hydration mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-inset px-3 text-[13px] font-semibold text-text"
    >
      <span className="only-dark flex items-center gap-2.5">
        <Sun size={18} strokeWidth={1.8} aria-hidden="true" />
        Mode terang
      </span>
      <span className="only-light flex items-center gap-2.5">
        <Moon size={18} strokeWidth={1.8} aria-hidden="true" />
        Mode gelap
      </span>
    </button>
  );
}
