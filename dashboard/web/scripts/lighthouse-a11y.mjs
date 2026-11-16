// Lighthouse accessibility score for every page in both themes (PLAN §13 Fase 6: >= 90).
// Uses Playwright's Chromium; the theme is put in localStorage first and Lighthouse is told not to
// clear storage, so the light theme is really audited.
//   pnpm lighthouse            (stack must be running: docker compose up)
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PAGES = ["/", "/kamera", "/prediksi/403225", "/analitik"];
const MIN = 90;

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox"],
});
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
const rows = [];
try {
  for (const theme of ["dark", "light"]) {
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => localStorage.setItem("arus-theme", t), theme);
    await page.close();
    for (const path of PAGES) {
      const { lhr } = await lighthouse(`${BASE}${path}`, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["accessibility"],
        disableStorageReset: true,
        formFactor: "desktop",
        screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
      });
      const score = Math.round(lhr.categories.accessibility.score * 100);
      const failed = Object.values(lhr.audits)
        .filter((a) => a.score === 0 && a.scoreDisplayMode === "binary")
        .map((a) => a.id);
      rows.push({ theme, path, score, failed: failed.join(", ") || "-" });
    }
  }
} finally {
  await browser.disconnect();
  await chrome.kill();
}
console.table(rows);
const bad = rows.filter((r) => r.score < MIN);
if (bad.length) {
  console.error(`Skor aksesibilitas < ${MIN}:`, bad);
  process.exit(1);
}
console.log(`OK: semua halaman >= ${MIN} di kedua tema.`);
