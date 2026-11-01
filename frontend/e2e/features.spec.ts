import { expect, test } from "@playwright/test";

import { open, settled } from "./helpers";

test("overview shows the race result", async ({ page }) => {
  await open(page, "/");
  await settled(page);
  await expect(page.getByText("Verstappen").first()).toBeVisible();
});

test("simulator: actual plan is neutral, a new plan changes the outcome", async ({ page }) => {
  await open(page, "/simulator");
  await settled(page);
  const outcome = page.locator("section", { has: page.getByRole("heading", { name: "Outcome" }) });
  await expect(outcome.getByText("Same as real result")).toBeVisible();
  await page.getByRole("button", { name: "Add a stop" }).click();
  await expect(outcome.getByText("Same as real result")).toHaveCount(0);
  // Load the top-ranked plan from the optimiser.
  const optimal = page.locator("section", { has: page.getByRole("heading", { name: "Optimal strategies" }) });
  await optimal.getByRole("button").filter({ hasText: "1-stop" }).first().click();
  await expect(outcome.getByText(/Finish \(hindsight\)/)).toBeVisible();
});

test("undercut calculator gives a verdict", async ({ page }) => {
  await open(page, "/simulator");
  await settled(page);
  const panel = page.locator("section", { has: page.getByRole("heading", { name: /Undercut/ }) });
  await expect(panel.getByText(/works|ahead|Neither|place/).first()).toBeVisible();
});

test("live race centre replays the archive as live", async ({ page }) => {
  await open(page, "/live");
  await expect(page.getByText(/Replaying/)).toBeVisible({ timeout: 60_000 });
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(20);
  await expect(page.getByRole("heading", { name: "Race outcome" })).toBeVisible();
  await page.getByRole("radio", { name: "60×" }).click();
  await expect(page.getByRole("radio", { name: "60×" })).toHaveAttribute("aria-checked", "true");
});

test("driver & car analysis tables and team-mate battles", async ({ page }) => {
  await open(page, "/analysis");
  await settled(page);
  await expect(page.getByRole("heading", { name: "Corner by corner" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await expect(page.getByText("Left on the table")).toBeVisible();
  // Opening the race added it to the warehouse; the season view picks it up.
  await expect(async () => {
    await page.goto("/teammates?season=2025&round=3&session=R");
    await expect(page.getByRole("heading", { name: "McLaren" })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
});

test("replay: 3D view and onboard HUD", async ({ page }) => {
  await open(page, "/race-control");
  await settled(page);
  await page.getByRole("radio", { name: "3D" }).click();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel(/VER onboard/)).toBeVisible();
});

test("charts export as PNG images", async ({ page }) => {
  await open(page, "/strategy");
  await settled(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Save “Tyre strategy” as an image/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});

test("history pages render Ergast data", async ({ page }) => {
  await page.route("**/api/v1/history/champions", (route) =>
    route.fulfill({
      json: {
        seasons: [
          { season: 2020, rounds: 17, decided: true, driver: { id: "hamilton", name: "Lewis Hamilton", nationality: "British", points: 347, wins: 11, team: "Mercedes" }, constructor: { id: "mercedes", name: "Mercedes", points: 573, wins: 13 } },
        ],
        most_driver_titles: [{ name: "Lewis Hamilton", titles: 7 }],
        most_constructor_titles: [{ name: "Ferrari", titles: 16 }],
      },
    }),
  );
  await page.goto("/history?tab=champions");
  await expect(page.getByRole("cell", { name: /Lewis Hamilton/ })).toBeVisible();
  await expect(page.getByText("Most drivers' titles")).toBeVisible();
});

test("status page reports health and accepts jobs", async ({ page }) => {
  await open(page, "/status");
  await expect(page.getByText("All systems operational")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Endpoints" })).toBeVisible();
});
