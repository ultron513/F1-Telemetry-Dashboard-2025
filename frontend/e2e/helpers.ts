import { expect, type Page } from "@playwright/test";

/** The one race weekend that ships in the repository's FastF1 cache. */
export const RACE = "season=2025&round=3&session=R&driver=VER&vs=NOR";

export async function open(page: Page, path: string, query = RACE) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}${query}`);
  await expect(page.locator("h1")).toBeVisible();
  return errors;
}

/** Wait until no loading spinners are left on the page. */
export async function settled(page: Page) {
  await expect(page.getByText(/Loading timing data|Loading the calendar|Preparing the replay|Loading session timing/)).toHaveCount(0, { timeout: 90_000 });
}
