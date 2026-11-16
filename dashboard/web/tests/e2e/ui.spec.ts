import { expect, test } from "@playwright/test";

import { PAGES, resetReplay, waitForData } from "./helpers";

test.beforeEach(async ({ request }) => resetReplay(request));

test("first visit is dark, OS preference is ignored", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await context.close();
});

test("navigation marks the active page with aria-current", async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.heading);
    const current = page.getByRole("navigation", { name: "Navigasi utama" }).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
  }
});

test("toggles expose aria-pressed and switch the map", async ({ page }) => {
  await page.goto("/");
  const horizon = page.getByRole("group", { name: "Pilih horizon waktu" });
  await expect(horizon.getByRole("button", { name: "Sekarang" })).toHaveAttribute("aria-pressed", "true");
  await horizon.getByRole("button", { name: "+3 jam" }).click();
  await expect(horizon.getByRole("button", { name: "+3 jam" })).toHaveAttribute("aria-pressed", "true");
  await expect(horizon.getByRole("button", { name: "Sekarang" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Prediksi Model B untuk pukul 19:45")).toBeVisible();

  const view = page.getByRole("group", { name: "Pilih tampilan peta" });
  await expect(view.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas").first()).toBeVisible();
  await view.getByRole("button", { name: "2D" }).click();
  await expect(view.getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Peta 2D/ })).toBeVisible();
});

test("replay step moves every panel and the WebSocket keeps the page in sync", async ({ page, request }) => {
  await page.goto("/");
  await waitForData(page);
  await expect(page.getByText("Rab, 7 Jun 2017 · 16:45")).toBeVisible();
  await page.getByRole("button", { name: "Maju 15 menit" }).click();
  await expect(page.getByText("Rab, 7 Jun 2017 · 17:00")).toBeVisible();
  await expect(page.getByText("Kondisi aktual pukul 17:00")).toBeVisible();
  // a change made elsewhere (API call) arrives over the WebSocket
  await request.post("http://localhost:8000/api/replay", { data: { action: "step", steps: -1 } });
  await expect(page.getByText("Rab, 7 Jun 2017 · 16:45")).toBeVisible();
});

test("prediksi horizon toggle", async ({ page }) => {
  await page.goto("/prediksi/403225");
  const g = page.getByRole("group", { name: "Tampilkan horizon" });
  await expect(g.getByRole("button", { name: "Keduanya" })).toHaveAttribute("aria-pressed", "true");
  await g.getByRole("button", { name: "1 jam" }).click();
  await expect(g.getByRole("button", { name: "1 jam" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Grafik prediksi sensor" })).not.toContainText("Prediksi 3 jam");
});

test("no horizontal page scroll at 390 px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const p of PAGES) {
    await page.goto(p.path);
    await waitForData(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${p.path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
  await context.close();
});
