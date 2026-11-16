"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { ThemeToggle } from "./ThemeToggle";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  "aria-hidden": true,
} as const;

const NAV = [
  {
    href: "/",
    label: "Ringkasan Kota",
    match: (p: string) => p === "/",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/kamera",
    label: "Kamera Live",
    match: (p: string) => p.startsWith("/kamera"),
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="6" width="14" height="12" rx="2" />
        <path d="M16.5 10.5 21.5 7.5v9l-5-3" />
      </svg>
    ),
  },
  {
    href: "/prediksi",
    label: "Prediksi Sensor",
    match: (p: string) => p.startsWith("/prediksi"),
    icon: (
      <svg {...iconProps}>
        <path d="M3 17l5-5 4 3 7-8" />
        <path d="M15 7h4v4" />
      </svg>
    ),
  },
  {
    href: "/analitik",
    label: "Analitik & Model",
    match: (p: string) => p.startsWith("/analitik"),
    icon: (
      <svg {...iconProps}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect x="0.5" y="0.5" width="35" height="35" rx="10" fill="var(--row-hl)" stroke="var(--accent-line)" />
      <path d="M7 22c4 0 4-8 8-8s4 8 8 8 4-8 6-8" fill="none" stroke="var(--lv-0)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 27c4 0 4-4 8-4s4 4 8 4 4-4 6-4" fill="none" stroke="var(--lv-3)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

const boxTitle = "text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

function PipelineStatus() {
  const rows = [
    { t: "Batch layer", d: "16,9 jt baris · 4 batch view", lv: "bg-lv-0" },
    { t: "Speed layer", d: "1 kamera · jendela 5 dtk", lv: "bg-lv-0" },
    { t: "Serving layer", d: "Mode replay data Juni 2017", lv: "bg-lv-1" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-inset p-4">
      <div className={boxTitle}>Status pipeline</div>
      {rows.map((r) => (
        <div key={r.t} className="flex items-start gap-2.5">
          <span className={cn("mt-1.5 size-2 flex-none rounded-full", r.lv)} />
          <div>
            <div className="text-[13px] font-semibold">{r.t}</div>
            <div className="text-xs text-muted">{r.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeedLayerSteps() {
  const steps = [
    { t: "Video 10 fps", d: "lebar 640 px" },
    { t: "YOLOv8 deteksi", d: "conf 0,2 · imgsz 640" },
    { t: "ByteTrack", d: "ID unik per kendaraan" },
    { t: "Fitur per jendela", d: "5 dtk, geser 2,5 dtk" },
    { t: "Model A", d: "Lancar / Padat / Macet" },
    { t: "Dashboard", d: "push via WebSocket" },
  ];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-inset p-4">
      <div className={boxTitle}>Alur speed layer</div>
      {steps.map((s, i) => (
        <div key={s.t} className="flex items-center gap-2.5 text-[13px]">
          <span className="mono flex size-[22px] flex-none items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-strong">
            {i + 1}
          </span>
          <div>
            <div className="font-semibold">{s.t}</div>
            {/* projector-height screens (≤ 820 px): titles only, so the sidebar doesn't need a scrollbar */}
            <div className="text-xs text-muted [@media(max-height:820px)]:hidden">{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelBands() {
  const bands = [
    { k: "Lancar", r: "≥ 0,8", c: "bg-lv-0" },
    { k: "Melambat", r: "0,6–0,8", c: "bg-lv-1" },
    { k: "Padat", r: "0,4–0,6", c: "bg-lv-2" },
    { k: "Macet", r: "< 0,4", c: "bg-lv-3" },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-inset p-4">
      <div className={boxTitle}>Ambang level</div>
      <div className="text-xs leading-normal text-text-2">
        Rasio kecepatan terhadap kecepatan arus bebas (v_ff) sensor:
      </div>
      {bands.map((b) => (
        <div key={b.k} className="flex items-center gap-2.5 text-[13px]">
          <span className={cn("size-2.5 rounded-[3px]", b.c)} />
          <span className="flex-auto">{b.k}</span>
          <span className="mono text-muted">{b.r}</span>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isAnalitik = pathname.startsWith("/analitik");

  let infoBox: React.ReactNode = null;
  if (pathname === "/") infoBox = <PipelineStatus />;
  else if (pathname.startsWith("/kamera")) infoBox = <SpeedLayerSteps />;
  else if (pathname.startsWith("/prediksi")) infoBox = <LevelBands />;

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex w-full flex-col gap-5 border-b border-border bg-nav px-4 py-5 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:w-[232px] min-[900px]:flex-none min-[900px]:gap-7 min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:px-5 min-[900px]:py-7 min-[900px]:[@media(max-height:820px)]:gap-4 min-[900px]:[@media(max-height:820px)]:py-5"
    >
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <div className="text-xl font-extrabold tracking-[-0.02em]">Arus</div>
          <div className="text-xs text-muted">Traffic Ops · Lambda</div>
        </div>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 min-[900px]:mx-0 min-[900px]:flex-col min-[900px]:overflow-visible min-[900px]:px-0">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-none items-center gap-3 whitespace-nowrap rounded-[10px] px-3 text-sm no-underline",
                active
                  ? "bg-accent-soft font-bold text-accent-strong hover:text-accent-strong"
                  : "font-medium text-nav-text hover:bg-raised hover:text-text",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>

      <ThemeToggle />

      {infoBox && <div className="hidden min-[900px]:block">{infoBox}</div>}

      <div className="mt-auto hidden text-xs leading-normal text-muted min-[900px]:block">
        {isAnalitik
          ? "Semua angka di halaman ini berasal dari output notebook 01–04."
          : "Data: PEMS-BAY (Caltrans), UCSD Traffic, Roboflow. Proyek Akhir Teknologi Big Data."}
      </div>
    </nav>
  );
}
