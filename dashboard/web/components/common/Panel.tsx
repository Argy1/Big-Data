import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-panel border-border",
  warn: "bg-warn-bg border-warn-line",
  alert: "bg-alert-bg border-alert-line",
} as const;

export function Panel({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: keyof typeof TONES }) {
  return (
    <section
      className={cn("rounded-panel border p-5 shadow-panel", TONES[tone], className)}
      {...props}
    />
  );
}
