import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { PAGES, resetReplay, setStoredTheme, waitForData } from "./helpers";

/**
 * PLAN §9.6: every page in both themes — a full-page screenshot is saved to
 * tests/e2e/__screenshots__/<page>-<theme>.png and axe (WCAG 2 A/AA, incl. colour contrast) must pass.
 */
for (const theme of ["dark", "light"] as const) {
  for (const p of PAGES) {
    test(`${p.name} · ${theme}: screenshot + axe`, async ({ page, context, request }) => {
      await resetReplay(request);
      await setStoredTheme(context, theme);
      await page.emulateMedia({ reducedMotion: "reduce" }); // stable 3D map (no auto-rotate)
      await page.goto(p.path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.heading);
      await waitForData(page);
      await page.waitForTimeout(1500); // charts / map tiles settle

      await page.screenshot({ path: `tests/e2e/__screenshots__/${p.name}-${theme}.png`, fullPage: true });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // the MJPEG stream / map canvases are images with alt or aria-label; their pixels aren't text
        .exclude(".maplibregl-canvas")
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
      );
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }
}
