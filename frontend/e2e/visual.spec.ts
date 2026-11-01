import { expect, test } from "@playwright/test";

import { open, settled } from "./helpers";

// Visual regression for the custom SVG charts. Baselines live in
// e2e/__screenshots__; update with `npm run test:visual -- --update-snapshots`.

const panel = (page: import("@playwright/test").Page, name: string | RegExp) =>
  page.locator("section", { has: page.getByRole("heading", { name }) }).first();

test("strategy gantt", async ({ page }) => {
  await open(page, "/strategy");
  await settled(page);
  await expect(panel(page, "Tyre strategy")).toHaveScreenshot("strategy-gantt.png");
});

test("track map", async ({ page }) => {
  await open(page, "/track-map");
  await settled(page);
  await expect(page.locator("svg[role=img]").first()).toHaveScreenshot("track-map.png");
});

test("simulator tyre model", async ({ page }) => {
  await open(page, "/simulator");
  await settled(page);
  await expect(panel(page, "Tyre model")).toHaveScreenshot("tyre-model.png");
});

test("driving style radar", async ({ page }) => {
  await open(page, "/analysis");
  await settled(page);
  await expect(panel(page, "Driving style")).toHaveScreenshot("driving-style.png");
});
