"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { useMetaSensors } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Search sensors by name, freeway or id; client-side filter of /api/meta/sensors (PLAN §2.1). */
export function SensorSearch() {
  const router = useRouter();
  const { data: sensors } = useMetaSensors();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !sensors) return [];
    return sensors
      .filter((s) =>
        [s.name, s.name_raw, s.fwy_label, String(s.sensor_id)].some((f) => f.toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  }, [q, sensors]);

  const go = (id: number) => {
    setOpen(false);
    setQ("");
    router.push(`/prediksi/${id}`);
  };

  return (
    <div className="relative w-full sm:w-[260px]">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Cari sensor atau ruas jalan
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Cari sensor atau ruas jalan…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter") go(results[active].sensor_id);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
        className="h-11 w-full rounded-full border border-border-strong bg-panel px-4 text-sm text-text placeholder:text-muted"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-12 right-0 left-0 z-30 max-h-80 overflow-y-auto rounded-xl border border-border-strong bg-panel p-1 shadow-lg"
        >
          {results.map((s, i) => (
            <li
              key={s.sensor_id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.sensor_id);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-lg px-3 py-2", i === active && "bg-raised")}
            >
              <div className="truncate text-sm font-semibold">{s.name}</div>
              <div className="mono text-xs text-muted">
                {s.fwy_label} · #{s.sensor_id}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
