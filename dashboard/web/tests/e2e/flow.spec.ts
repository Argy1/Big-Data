import { expect, test } from "@playwright/test";

import { resetReplay, waitForData } from "./helpers";

/**
 * PLAN §13 Fase 6: Ringkasan → klik peringatan → Prediksi → Catat keputusan → Kamera → Analitik → ganti tema.
 * Writes a real decision into appdata/arus.sqlite: run `python scripts/reset_demo.py` before a demo.
 */
test("demo flow", async ({ page, request }) => {
  await resetReplay(request);

  // 1. Ringkasan at 16:45 (PLAN §16 step 1)
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kondisi lalu lintas saat ini");
  const kpis = page.getByRole("region", { name: "Indikator utama" });
  await expect(kpis).toContainText("83,1");
  await expect(kpis).toContainText("89");
  await expect(kpis).toContainText("117");
  // horizon +1 jam: caption + legend follow
  await page.getByRole("group", { name: "Pilih horizon waktu" }).getByRole("button", { name: "+1 jam" }).click();
  await expect(page.getByText("Prediksi Model B untuk pukul 17:45")).toBeVisible();

  // 2. early-warning list -> Airport Blvd
  const alerts = page.getByRole("region", { name: "Peringatan dini" });
  await expect(alerts.getByRole("link").first()).toContainText("Airport Blvd");
  await alerts.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/prediksi\/403225$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Airport Blvd · I-880 S");
  const cards = page.getByRole("region", { name: "Ringkasan prediksi" });
  await expect(cards).toContainText("99");
  await expect(cards).toContainText("46");
  await expect(cards).toContainText("100");
  await expect(page.getByRole("heading", { name: "Kenapa diprediksi padat?" })).toBeVisible();

  // record a decision -> toast
  const actions = page.getByRole("region", { name: "Tindakan" });
  await actions.getByRole("checkbox").first().check();
  await actions.getByRole("checkbox").nth(2).check();
  await actions.getByRole("button", { name: "Catat keputusan" }).click();
  await expect(page.getByText("Keputusan dicatat")).toBeVisible();
  await expect(actions.getByRole("checkbox").first()).not.toBeChecked();

  // 3. Kamera (works with a live worker or the notebook reference)
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Kamera Live" }).click();
  await expect(page).toHaveURL(/\/kamera$/);
  await expect(page.getByRole("region", { name: "Keputusan Model A" })).toContainText("Macet");
  await expect(page.getByRole("region", { name: "Detektor" })).toContainText("COCO");

  // 4. Analitik: heatmap peak + three model cards from the API
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Analitik & Model" }).click();
  await waitForData(page);
  await expect(page.getByRole("region", { name: "Heatmap hari dan jam" })).toContainText("Kamis 17:00 (33,1%)");
  await expect(page.getByRole("region", { name: "Tren harian" }).getByRole("heading")).toHaveText("Tren harian · 181 hari");
  await expect(page.getByRole("region", { name: "Kinerja model" }).getByRole("article")).toHaveCount(3);

  // 5. theme toggle: light, survives a reload, no reload needed to apply
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Mode terang" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Mode gelap" })).toBeVisible();
});
