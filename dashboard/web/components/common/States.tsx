import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-inset motion-reduce:animate-none", className)} />;
}

export function ErrorState({ message = "Data gagal dimuat.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-alert-line bg-alert-bg px-4 py-3 text-sm">
      <span className="text-lv-3-text">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-9 cursor-pointer rounded-lg border border-border-strong bg-panel px-3 text-[13px] font-semibold">
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-inset px-4 py-6 text-center text-sm text-muted">{children}</div>;
}
