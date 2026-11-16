/** Eyebrow 12/700 uppercase + H1 30/800, page controls on the right (PLAN §2, §10.1). */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{eyebrow}</div>
        <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">{title}</h1>
      </div>
      {children}
    </header>
  );
}
