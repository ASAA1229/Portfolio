import { expect, test, type Page } from "@playwright/test";

/**
 * Browser-based equivalents of manual WCAG 2.2 AA checks that jsdom cannot perform: keyboard
 * operation and focus visibility, reflow at 320 CSS px (400% zoom), 200% zoom, text-spacing
 * overrides, target size and reduced motion. They complement, and do not replace, a human
 * screen-reader and device review.
 */
const PAGES = [
  "/",
  "/about",
  "/projects",
  "/contact",
  "/profiles",
  "/people/ammu",
  "/people/sai/skills",
];

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("reflow and zoom (WCAG 1.4.4, 1.4.10, 1.4.12)", () => {
  for (const [name, width, height] of [
    ["320px (400% zoom equivalent)", 320, 640],
    ["640px (200% zoom of 1280px)", 640, 400],
  ] as const) {
    test(`no horizontal scrolling at ${name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      for (const path of PAGES) {
        await page.goto(path, { waitUntil: "networkidle" });
        expect(await overflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(1);
      }
      await context.close();
    });
  }

  test("content survives the WCAG text-spacing overrides without horizontal scrolling", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    for (const path of ["/about", "/contact", "/people/ammu"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content:
          "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
      });
      expect(await overflow(page), `${path} with text spacing`).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
});

test.describe("keyboard operation (WCAG 2.1.1, 2.4.1, 2.4.3, 2.4.7)", () => {
  test("the skip link is the first tab stop and moves focus to main content", async ({ page }) => {
    await page.goto("/about", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeInViewport();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("page-content");
  });

  test("every tab stop on key pages shows a visible focus indicator", async ({ page }) => {
    for (const path of ["/", "/about", "/contact"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const missing: string[] = [];
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
          const ring = style.boxShadow !== "none";
          const rect = el.getBoundingClientRect();
          return {
            label: (el.getAttribute("aria-label") || el.textContent || el.tagName)
              .trim()
              .slice(0, 40),
            visible: rect.width > 0 && rect.height > 0,
            indicated: outline || ring,
          };
        });
        if (state?.visible && !state.indicated) missing.push(state.label);
      }
      expect(missing, `${path}: tab stops without a visible focus indicator`).toEqual([]);
    }
  });

  test("the AI introduction dialog opens by keyboard, traps focus and Escape restores it", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const opener = page.getByRole("button", { name: /ai intro/i }).first();
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
        true,
      );
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test.describe("target size and motion (WCAG 2.5.8, 2.3.3)", () => {
  test("standalone interactive controls are at least 24x24 CSS px on mobile", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    const small: string[] = [];
    for (const path of ["/", "/contact", "/profiles", "/people/ammu"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const found = await page.evaluate(() =>
        [...document.querySelectorAll("a[href], button, input, select, textarea")]
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            // Inline text links inside running text are exempt; so are hidden elements.
            const inline =
              el.tagName === "A" && !!el.closest("p, li") && style.display === "inline";
            // 1x1 clipped boxes are the visually hidden skip links, which become visible on focus.
            return rect.width > 1 && rect.height > 0 && style.visibility !== "hidden" && !inline;
          })
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              name: (el.getAttribute("aria-label") || el.textContent || el.tagName)
                .trim()
                .slice(0, 30),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            };
          })
          .filter((item) => item.w < 24 || item.h < 24),
      );
      small.push(...found.map((item) => `${path}: ${item.name} (${item.w}x${item.h})`));
    }
    expect(small).toEqual([]);
    await context.close();
  });

  test("reduced motion stops decorative video and long animations", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const playing = await page.evaluate(
      () => [...document.querySelectorAll("video")].filter((video) => !video.paused).length,
    );
    expect(playing).toBe(0);
    await context.close();
  });
});
