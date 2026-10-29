import { test, expect } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const errors: string[] = [];
test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => errors.push(e.message));
});

test("every public page loads, has one h1, and the nav reaches the others", async ({ page }) => {
  for (const path of ["/", "/sample", "/judge", "/method", "/evidence", "/compare", "/group", "/trace", "/app"]) {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status(), path).toBe(200);
    expect(await page.locator("h1").count(), `${path} h1`).toBeGreaterThanOrEqual(1);
  }
  await page.goto("/");
  for (const name of ["Method", "Evidence", "For judges", "Open app"]) {
    await page.locator("nav").getByRole("link", { name }).first().click();
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});

test("landing shows the headline and two actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("The Songs He Still Knows.");
  expect(await page.locator("section.hero a.btn").count()).toBe(2);
});

test("sample: each resident shows a card with items, a model status line and working links", async ({ page }) => {
  await page.goto("/sample", { waitUntil: "networkidle" });
  const select = page.locator("select").first();
  const options = await select.locator("option").allTextContents();
  expect(options.length).toBeGreaterThanOrEqual(5);
  for (const o of options) {
    await select.selectOption({ label: o });
    await expect(page.getByRole("link", { name: "Play" }).first()).toBeVisible({ timeout: 90000 });
    await expect(page.locator("#main")).toContainText(o.split(",")[0]);
  }
  await expect(page.getByText("Sample").first()).toBeVisible();
});

test("sample: session mode opens and steps through items", async ({ page }) => {
  await page.goto("/sample/sample-walter/session", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText(/Walter|Otis|remember/i);
  const buttons = page.getByRole("button");
  expect(await buttons.count()).toBeGreaterThan(2);
});

test("sample: the exported card passes the offline verifier", async ({ page, request }) => {
  await page.goto("/sample", { waitUntil: "networkidle" });
  const href = await page.getByRole("link", { name: /Download for the offline verifier/ }).getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  const dir = mkdtempSync(join(tmpdir(), "aftersong-"));
  const f = join(dir, "export.json");
  writeFileSync(f, await res.text());
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync("node", ["../scripts/verify-card.mjs", f], { encoding: "utf8" });
  expect(out).toMatch(/pass/i);
});

test("compare: the plain AI list runs and is checked against the same rules", async ({ page }) => {
  await page.goto("/compare?r=sample-walter", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run the plain AI list now" }).click();
  await expect(page.locator("#main")).toContainText(/passed|rejected|not in Qloo|outside|unavailable|limit/i, { timeout: 150000 });
});

test("group: the planner returns a plan", async ({ page }) => {
  await page.goto("/group", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Plan the session" }).click();
  await expect(page.locator("body")).toContainText(/room|group|shared|together/i, { timeout: 60000 });
});

test("judge: hard case and abstention preset answer", async ({ page }) => {
  await page.goto("/judge", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run the hard case" }).click();
  await expect(page.locator("body")).toContainText(/item|card|rejected|years/i, { timeout: 150000 });
  await page.getByRole("button", { name: "Run the abstention preset" }).click();
  await expect(page.locator("body")).toContainText(/not enough|abstain|no card|thin|from these years/i, { timeout: 150000 });
});

test("status: backend, Qloo and the model are reported by real probes", async ({ request }) => {
  const s = await (await request.get("/api/status")).json();
  expect(s.backend.reachable).toBe(true);
  expect(s.backend.body.qloo.ok).toBe(true);
  expect(s.backend.body.storage.kind).toBe("supabase");
  expect(s.backend.body.model.ok, `model: ${s.backend.body.model.detail}`).toBe(true);
});
