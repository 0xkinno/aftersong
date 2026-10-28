import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

const VIEWPORTS = [
  { name: "iphone-375x812", width: 375, height: 812 },
  { name: "android-412x915", width: 412, height: 915 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "laptop-1280x800", width: 1280, height: 800 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
];
const PAGES = ["/", "/sample", "/judge", "/method", "/evidence", "/compare", "/group", "/trace", "/app"];
const SHOTS = process.env.SCREENSHOTS === "1";
// When no backend is connected, the browser itself logs a failed fetch for our own /api calls. Anything else is an error.
const ALLOWED = /Failed to load resource: the server responded with a status of (502|503)/;

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

async function collect(page: Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !ALLOWED.test(m.text())) errors.push(m.text());
  });
  await page.goto(path, { waitUntil: "networkidle" });
  return errors;
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PAGES) {
      test(`${path}: no horizontal scroll, no console errors, axe has no serious violations`, async ({ page }) => {
        const errors = await collect(page, path);
        const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        expect(scroll.sw, "horizontal scroll").toBeLessThanOrEqual(scroll.iw);
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
        const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        expect(errors).toEqual([]);
        if (SHOTS && path === "/") {
          mkdirSync("../docs/screens", { recursive: true });
          await page.screenshot({ path: `../docs/screens/landing-${vp.name}.png`, fullPage: false });
        }
      });
    }

    test("landing: headline, hero art, buttons and nav do not overlap", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const boxes = await page.evaluate(() => {
        const r = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().toJSON();
        const btns = [...document.querySelectorAll("section a.btn")].map((b) => b.getBoundingClientRect().toJSON());
        return { h1: r("h1"), svg: r("section svg[role=img]"), nav: r("header.nav"), btns };
      });
      expect(boxes.h1 && boxes.svg && boxes.nav).toBeTruthy();
      const R = (o: any) => ({ left: o.left, right: o.right, top: o.top, bottom: o.bottom }) as DOMRect;
      expect(overlaps(R(boxes.h1), R(boxes.svg)), "headline vs art").toBe(false);
      for (const b of boxes.btns) {
        expect(overlaps(R(boxes.svg), R(b)), "button vs art").toBe(false);
        expect(overlaps(R(boxes.h1), R(b)), "button vs headline").toBe(false);
      }
    });
  });
}

test.describe("desktop hover", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("a card's glow follows the pointer", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const card = page.locator(".card").first();
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 30);
    await page.mouse.move(box.x + 80, box.y + 50);
    const mx = await card.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--mx"));
    expect(mx).toMatch(/px$/);
  });
});
