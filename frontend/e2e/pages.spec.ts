import { expect, test } from "@playwright/test";

import { open, settled } from "./helpers";

const PAGES: [string, RegExp][] = [
  ["/", /Japanese Grand Prix|Overview/],
  ["/ask", /Ask the pit wall/],
  ["/telemetry", /Telemetry/],
  ["/laps", /Lap analysis/],
  ["/track-map", /Track map/],
  ["/strategy", /Strategy/],
  ["/simulator", /Strategy simulator/],
  ["/analysis", /Driver & car analysis/],
  ["/performance", /Head to head/],
  ["/race-control", /Race control/],
  ["/weather", /Weather/],
  ["/standings", /Standings|Championship/],
  ["/teammates", /Team-mate battles/],
  ["/settings", /Settings/],
  ["/status", /System status/],
];

for (const [path, heading] of PAGES) {
  test(`${path} renders without errors`, async ({ page }) => {
    const errors = await open(page, path);
    await expect(page.locator("h1")).toHaveText(heading);
    await settled(page);
    await expect(page.getByText(/Something went wrong|Request failed with status 5/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("sidebar navigation keeps the selected session", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("navigation").getByRole("link", { name: "Simulator", exact: true }).click();
  await expect(page).toHaveURL(/\/simulator\?.*round=3/);
  await expect(page.locator("h1")).toHaveText("Strategy simulator");
});
