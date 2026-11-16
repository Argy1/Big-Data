import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:8000";
export const DEMO_TS = "2017-06-07T16:45:00";

export const PAGES = [
  { path: "/", name: "ringkasan", heading: "Kondisi lalu lintas saat ini" },
  { path: "/kamera", name: "kamera", heading: "Kamera live" },
  { path: "/prediksi/403225", name: "prediksi", heading: "Airport Blvd · I-880 S" },
  { path: "/analitik", name: "analitik", heading: "Pola kemacetan Januari–Juni 2017" },
] as const;

/** Every test starts at the demo moment (Rab, 7 Jun 2017 16:45), replay paused. */
export async function resetReplay(request: APIRequestContext) {
  await request.post(`${API}/api/replay`, { data: { action: "pause" } });
  await request.post(`${API}/api/replay`, { data: { action: "seek", ts: DEMO_TS } });
}

/** Set the stored theme before any page script runs (what next-themes reads on load). */
export async function setStoredTheme(context: BrowserContext, theme: "dark" | "light") {
  await context.addInitScript((t) => {
    try {
      window.localStorage.setItem("arus-theme", t);
    } catch {
      /* storage blocked */
    }
  }, theme);
}

/** Wait until the page's data has arrived (no skeletons left in <main>). */
export async function waitForData(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll("main .animate-pulse").length === 0, null, { timeout: 30_000 });
}
