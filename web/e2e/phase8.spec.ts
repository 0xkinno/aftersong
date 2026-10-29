import { test, expect, type Page } from "@playwright/test";

// SYNTHETIC data only. These tests mock the API so layout and behaviour can be checked without Qloo.
const item = (i: number, over: Record<string, unknown> = {}) => ({
  entityId: `SYN-${i}`, name: `Synthetic item ${i}`, domain: (["music", "music", "music", "film", "film", "tv", "food", "place"] as const)[i % 8], year: 1955 + i,
  label: i % 3 === 0 ? "personal" : i % 3 === 1 ? "shared_era" : "widely_known", cohortUnknown: false, popularity: 0.3,
  connectedTo: { id: "SYN-FAV", name: "Synthetic Favourite", kind: "favourite" }, connectedAll: [{ id: "SYN-FAV", name: "Synthetic Favourite" }], connectionBasis: "explainability",
  tags: [{ id: "t1", name: "1960s" }], opener: { text: `Do you remember Synthetic item ${i}, from ${1955 + i}?`, source: "template" }, ...over,
});
const card = (n = 8, over: Record<string, unknown> = {}) => ({
  id: "card-syn", residentId: "sample-walter", createdAt: "2026-10-29T00:00:00Z", window: { start: 1950, end: 1970 }, widenedBy: 0, status: n >= 6 ? "ok" : "thin",
  items: Array.from({ length: n }, (_, i) => item(i)), rejections: [], abstentions: n >= 6 ? [] : [{ domain: "card", message: "Not enough from these years yet.", canWiden: true }],
  model: null, trail: [{ at: "2026-10-29T00:00:00Z", tool: "agent", summary: "No model is configured." }],
  decisions: [{ at: "2026-10-29T00:00:00Z", decision: "abstain_domain", why: "film: not enough from these years yet.", call: null, count: 0 }], calls: [], version: 1, ...over,
});
const residents = { sample: true, residents: [{ id: "sample-walter", firstName: "Walter", birthYear: 1940, hometown: "Port Harcourt, Nigeria", careCity: "San Antonio, Texas", favourites: [{ text: "Synthetic Favourite", confirmed: true, name: "Synthetic Favourite" }] }] };

async function mockSample(page: Page, c = card()) {
  await page.route("**/api/sample/residents", (r) => r.fulfill({ json: residents }));
  await page.route("**/api/sample/residents/*/card", (r) => (r.request().method() === "GET" ? r.fulfill({ json: { card: c, cached: true } }) : r.fulfill({ status: 404, json: {} })));
}
const ndjson = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

test.describe("G: first screen and name", () => {
  const BAN = ["engine", "layer", "pipeline", "orchestration", "protocol", "invariant", "framework", "infrastructure", "swarm", "kernel", "primitive", "semantic", "idempotent", "plane", "fence", "cryptographic", "finality", "merkle"];
  for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
    test(`first screen at ${vp.width}: the person, the moment, the action, the discovery sentence, two buttons, no system words`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto("/", { waitUntil: "networkidle" });
      const hero = page.locator("section.hero");
      const text = (await hero.innerText()).toLowerCase();
      for (const w of BAN) expect(text, `first screen must not contain "${w}"`).not.toContain(w);
      expect(text).toContain("marisol");
      expect(text).toContain("twenty minutes");
      expect(text).toContain("turns three remembered favourites");
      expect(await page.getByTestId("discovery").innerText()).not.toEqual("");
      expect(await hero.locator("a.btn").count()).toBe(2);
    });
  }
  test("the product name and headline never use the word taste", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    expect(await page.title()).not.toMatch(/taste/i);
    expect(await page.locator("h1").first().innerText()).not.toMatch(/taste/i);
    expect(await page.locator("section.hero").innerText()).not.toMatch(/taste/i);
  });
  test("the hero photograph is decorative, masked and at about 20 percent", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const bg = page.locator(".hero-bg");
    expect(await bg.getAttribute("aria-hidden")).toBe("true");
    expect(await bg.evaluate((el) => getComputedStyle(el).opacity)).toBe("0.2");
    expect(await bg.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)).toContain("linear-gradient");
    expect(await bg.locator("img").getAttribute("alt")).toBe("");
    const res = await page.request.get("/hero.webp");
    expect(res.status()).toBe(200);
    expect((await res.body()).length).toBeLessThan(300 * 1024);
  });
});

test.describe("A: Sample label on every sample screen", () => {
  for (const path of ["/sample", "/judge", "/compare", "/group", "/trace", "/sample/sample-walter/session"]) {
    test(`${path} says Sample`, async ({ page }) => {
      await mockSample(page);
      await page.route("**/api/sample/group", (r) => r.fulfill({ json: {} }));
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await page.locator("main").textContent()).toMatch(/sample/i);
    });
  }
});

test.describe("E5: abstention preset", () => {
  test("a thin result shows the abstention screen and pads nothing", async ({ page }) => {
    const thin = card(2);
    await page.route("**/api/try", (r) => r.fulfill({ contentType: "application/x-ndjson", body: ndjson([{ type: "trail", at: "x", tool: "find_era_items", summary: "film: 2 candidates" }, { type: "card", card: thin, modelNote: null }]) }));
    await page.goto("/judge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Run the abstention preset" }).click();
    const box = page.getByTestId("abstention-preset");
    await expect(box.getByText("Not enough from these years yet").first()).toBeVisible();
    expect(await box.locator("ol li h3").count(), "no item beyond the two returned").toBe(2);
  });
  test("a domain with nothing in those years abstains and nothing is added in its place", async ({ page }) => {
    const c = card(6, { abstentions: [{ domain: "tv", message: "Not enough from these years yet.", canWiden: true }, { domain: "food", message: "Not enough from these years yet.", canWiden: true }] });
    c.items = c.items.filter((i: { domain: string }) => i.domain !== "tv" && i.domain !== "food").concat([item(10, { domain: "music" }), item(11, { domain: "film" })]);
    await page.route("**/api/try", (r) => r.fulfill({ contentType: "application/x-ndjson", body: ndjson([{ type: "card", card: c, modelNote: null }]) }));
    await page.goto("/judge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Run the abstention preset" }).click();
    const box = page.getByTestId("abstention-preset");
    await expect(box.getByText(/Nothing placed for: Television, Food/)).toBeVisible();
    expect(await box.locator("ol li h3").count()).toBe(c.items.length);
    expect(await box.locator("ol li").filter({ hasText: /Television|Food/ }).count()).toBe(0);
  });

  test("when the favourite cannot be matched, no card is built", async ({ page }) => {
    await page.route("**/api/try", (r) => r.fulfill({ contentType: "application/x-ndjson", body: ndjson([{ type: "error", status: 409, error: "confirm", code: "NEEDS_CONFIRMATION" }]) }));
    await page.goto("/judge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Run the abstention preset" }).click();
    const box = page.getByTestId("abstention-preset");
    await expect(box.getByText("Not enough to build a card")).toBeVisible();
    expect(await box.locator("ol li h3").count()).toBe(0);
  });
});

test.describe("F: card fields and print", () => {
  test("each item shows year, domain, label, Because of, one opener and a plain search link", async ({ page }) => {
    await mockSample(page);
    await page.goto("/sample", { waitUntil: "networkidle" });
    const first = page.locator("ol li").first();
    await expect(first).toContainText("1955");
    await expect(first).toContainText(/Music|Film|Television|Food|Place/);
    await expect(first).toContainText(/Personal|Shared era|Widely known/);
    await expect(first).toContainText("Because of: Synthetic Favourite");
    const play = first.getByRole("link", { name: /Play|Find on a map/ });
    expect(await play.getAttribute("href")).toMatch(/^https:\/\/(www\.youtube\.com\/results\?search_query=|www\.google\.com\/maps\/search\/)/);
    expect(await play.getAttribute("rel")).toContain("noopener");
  });
  test("How this card was made is on the card screen and shows the decisions", async ({ page }) => {
    await mockSample(page);
    await page.goto("/sample", { waitUntil: "networkidle" });
    const how = page.getByTestId("how-made");
    await how.locator("summary").click();
    await expect(how).toContainText("abstain domain");
    await expect(how).toContainText("film: not enough from these years yet.");
  });
  for (const format of ["A4", "Letter"] as const) {
    test(`print: eight items fit one ${format} page`, async ({ page }) => {
      await mockSample(page);
      await page.goto("/sample", { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ format, printBackground: true });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(pages).toBe(1);
    });
  }
});

test.describe("F: session mode on a 375 px phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("every control is at least 56 px and the actions sit in the lower half", async ({ page }) => {
    await mockSample(page);
    await page.goto("/sample/sample-walter/session", { waitUntil: "networkidle" });
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main a, main button, main input")]
        .filter((el) => !(el as HTMLElement).closest("header") && (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ t: (el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }))
        .filter((b) => b.h < 56),
    );
    expect(small).toEqual([]);
    const next = await page.getByRole("button", { name: "Next" }).boundingBox();
    expect(next!.y).toBeGreaterThan(812 / 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test("offline: taps queue on the phone and sync when the connection returns", async ({ page, context }) => {
    await mockSample(page);
    const posted: unknown[] = [];
    let down = false;
    await page.route("**/api/sample/taps", async (r) => {
      if (down) return r.abort("internetdisconnected");
      posted.push(r.request().postDataJSON());
      await r.fulfill({ json: { ok: true, saved: false } });
    });
    await page.goto("/sample/sample-walter/session", { waitUntil: "networkidle" });
    down = true;
    await context.setOffline(true);
    await expect(page.getByTestId("sync-status")).toContainText("No connection");
    await page.getByRole("button", { name: "Lit up" }).click();
    await expect(page.getByTestId("sync-status")).toContainText("1 waiting to sync");
    expect(posted.length).toBe(0);
    down = false;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("sync-status")).not.toContainText("waiting");
    expect(posted.length).toBe(1);
    expect(posted[0]).toMatchObject({ entityId: "SYN-0", value: "lit_up" });
  });
});

test("F: the service worker file is served and caches only session pages and card data", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("session");
  expect(body).toContain("cards");
});
