import { levelLabel, type Level } from "@/lib/levels";
import { cn } from "@/lib/utils";

// Full class names so Tailwind can see them (no string-built classes)
const TINT = ["bg-lv-0-tint text-lv-0-text", "bg-lv-1-tint text-lv-1-text", "bg-lv-2-tint text-lv-2-text", "bg-lv-3-tint text-lv-3-text"];
const SOLID = ["bg-lv-0 text-on-solid", "bg-lv-1 text-on-solid", "bg-lv-2 text-on-solid", "bg-lv-3 text-on-solid"];
export const LEVEL_BG = ["bg-lv-0", "bg-lv-1", "bg-lv-2", "bg-lv-3"];
export const LEVEL_TEXT = ["text-lv-0-text", "text-lv-1-text", "text-lv-2-text", "text-lv-3-text"];

/** Pill with the level name; `solid` for use on top of video / strong colour (PLAN §10.2). */
export function LevelChip({
  level,
  solid = false,
  upper = false,
  children,
  className,
}: {
  level: Level | null | undefined;
  solid?: boolean;
  upper?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const tone = level == null ? "bg-inset text-muted" : (solid ? SOLID : TINT)[level];
  const text = children ?? levelLabel(level);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap",
        upper && "tracking-[0.04em] uppercase",
        tone,
        className,
      )}
    >
      {text}
    </span>
  );
}
