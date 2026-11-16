/** Indonesian number & time formatting (PLAN §7). Times are naive California local: never converted. */

const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = nfCache.get(key);
  if (!f) {
    // halfEven = Python's round(), which the backend and notebooks use: 100,5 -> 100 and
    // 0,6785 -> 0,678, so the UI shows the same numbers as the API tests (PLAN §12).
    f = new Intl.NumberFormat("id-ID", { minimumFractionDigits: min, maximumFractionDigits: max, roundingMode: "halfEven" });
    nfCache.set(key, f);
  }
  return f;
}

/** 83.08 -> "83,1"; null -> "–". Negative numbers use a real minus sign (−3,3). */
export function fmtNum(v: number | null | undefined, digits = 1, fixed = true): string {
  if (v == null || Number.isNaN(v)) return "–";
  return nf(fixed ? digits : 0, digits).format(v).replace("-", "−");
}

/** Signed: +2,1 / −3,3 */
export function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "–";
  return (v > 0 ? "+" : "") + fmtNum(v, digits);
}

export function fmtPct(v: number | null | undefined, digits = 1, fixed = true): string {
  return v == null ? "–" : `${fmtNum(v, digits, fixed)}%`;
}

/** 16_937_700 -> "16,9 jt" */
export function fmtMillions(v: number): string {
  return `${fmtNum(v / 1e6, 1)} jt`;
}

/** Parse "2017-06-07T16:45:00" as a naive local time (no timezone shift). */
export function parseNaive(ts: string): Date {
  const [d, t = "00:00:00"] = ts.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm, ss] = t.split(":").map((x) => Number.parseFloat(x));
  return new Date(y, m - 1, day, hh, mm, Math.floor(ss || 0));
}

/** Date -> "2017-06-07T16:45:00" (naive) */
export function toNaive(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function fmtClock(ts: string | Date): string {
  const d = typeof ts === "string" ? parseNaive(ts) : ts;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Rab, 7 Jun 2017 · 16:45" */
export function fmtReplayTs(ts: string): string {
  const d = parseNaive(ts);
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} · ${fmtClock(d)}`;
}

/** "Rabu, 7 Juni 2017" */
export function fmtLongDate(ts: string): string {
  const d = parseNaive(ts);
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Rabu" */
export function dayLong(ts: string): string {
  return DAYS_LONG[parseNaive(ts).getDay()];
}

/** ts + hours, as a naive string */
export function addHours(ts: string, hours: number): string {
  const d = parseNaive(ts);
  d.setMinutes(d.getMinutes() + hours * 60);
  return toNaive(d);
}

/** decimal hour 16.75 -> "16:45" */
export function fmtDecimalHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function dateOnly(ts: string): string {
  return ts.slice(0, 10);
}
