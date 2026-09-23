import { chromium as installedChromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { preview } from "vite";
const server = process.env.TEST_URL
  ? null
  : await preview({
      preview: { host: "127.0.0.1", port: 4173, strictPort: false },
    });
const chromium = installedChromium;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const base =
  process.env.TEST_URL ||
  `http://127.0.0.1:${server.httpServer.address().port}/`;
const results = [],
  pageErrors = [];
await mkdir("test-results", { recursive: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
});
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
const messages = [];
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    messages.push(message.text());
});
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector("#flightSummary")?.textContent.includes("m") &&
      document.querySelector("#computation")?.hidden,
  );
const setNumber = async (id, value) => {
  await page.locator("#" + id).fill(String(value));
  await page.locator("#" + id).dispatchEvent("change");
};
try {
  await page.goto(base);
  await ready();
  await page.waitForFunction(
    () =>
      !document.getElementById("engineStatus").classList.contains("is-loading"),
  );
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.equal(
    (await page.locator("#diagnosticWarnings li").count()) >= 2,
    true,
  );
  assert.match(await page.locator("#engineStatus").textContent(), /^3D/);
  results.push("Opstart, 3D, systemtema og synlige diagnostikadvarsler");
  await page.locator('[data-panel="flight"]').click();
  await page.screenshot({ path: "test-results/mobile-3d.png" });
  await page.locator('[data-panel="analysis"]').click();
  // A target around the existing landing and no perturbations gives a reproducible all-hit round.
  const summary = await page.locator("#targetSummary").textContent();
  const forward = Number(summary.match(/([\d,]+) m frem/)[1].replace(",", "."));
  const lateral =
    Number(
      summary
        .match(/([\d,]+) m (?:til )?(højre|venstre)/)?.[1]
        ?.replace(",", ".") || 0,
    ) * (/venstre/.test(summary) ? -1 : 1);
  await setNumber(
    "targetDistance",
    Math.max(5, Math.min(250, Math.round(forward))),
  );
  await setNumber(
    "targetLateral",
    Math.max(-100, Math.min(100, Math.round(lateral))),
  );
  await setNumber("targetRadius", 30);
  for (const key of [
    "spreadPower",
    "spreadAngle",
    "spreadSpin",
    "spreadWind",
    "spreadLaunch",
    "spreadAim",
  ])
    await setNumber(key, 0);
  await page.locator("#startRound").click();
  for (let i = 0; i < 8; i++) {
    await page.locator("#roundThrow").click();
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(".round-cell.hit,.round-cell.miss").length ===
        count,
      i + 1,
    );
  }
  await page.waitForFunction(() =>
    document.getElementById("roundBest").textContent.includes("Bedst"),
  );
  assert.equal(await page.locator(".round-cell.hit").count(), 8);
  assert.equal(await page.locator("#roundStreak").textContent(), "8 i træk");
  await page.locator("#roundTitle").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/mobile-light-round.png" });
  results.push("8/8 ramt, 8 i træk og rekord gemt");
  await page.locator('[data-view="profile"]').click();
  await page.locator("#themeSelect").selectOption("dark");
  await page.reload();
  await ready();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.locator('[data-panel="analysis"]').click();
  await page.locator("#startRound").click();
  assert.match(await page.locator("#roundBest").textContent(), /8 \/ 8/);
  // Resetting settings cancels an incomplete round and requires explicit restart.
  await setNumber("targetRadius", 29);
  assert.equal(await page.locator("#roundThrow").isDisabled(), true);
  await page.locator("#roundTitle").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/mobile-dark-round.png" });
  results.push(
    "Tema og rekord bevaret efter genindlæsning; ændringer afbryder runden",
  );
  await page.locator('[data-view="profile"]').click();
  await page.waitForFunction(() =>
    document
      .getElementById("offlineStatus")
      .textContent.includes("Klar offline"),
  );
  await context.setOffline(true);
  await page.reload();
  await ready();
  const licensePage = await context.newPage();
  await licensePage.goto(base + "licenses/Shotshaper-GPL-3.0.txt");
  assert.match(
    await licensePage.locator("body").textContent(),
    /GNU GENERAL PUBLIC LICENSE/,
  );
  await licensePage.close();
  await page.locator("#physicsModel").selectOption("legacy");
  await page.locator("#simulate").click();
  await ready();
  await page.locator('[data-panel="throw"]').click();
  await page.locator("#physicsModel").selectOption("sixdof-v5");
  await page.locator("#simulate").click();
  await ready();
  results.push(
    "Offline genindlæsning og første skift til Legacy/V5 med cached worker-moduler",
  );
  await context.setOffline(false);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["simulator", "bag", "profile"]) {
      await page.locator(`[data-view="${view}"]`).click();
      if (view === "simulator")
        for (const pane of ["disc", "throw", "wind", "analysis", "flight"]) {
          const tab = page.locator(`[data-panel="${pane}"]`);
          if (await tab.isVisible()) await tab.click();
          else
            assert.equal(
              pane,
              "flight",
              "Kun bane-fanen må være skjult i delt desktopvisning",
            );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          assert.equal(
            overflow,
            false,
            `${width}px ${pane} har vandret overflow`,
          );
        }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
  }
  results.push("Ingen vandret overflow ved 320, 390, 768 og 1280 px");
  // A browser without WebGL must retain the same working 2D simulator.
  const fallback = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return String(type).includes("webgl")
        ? null
        : original.call(this, type, ...args);
    };
  });
  const fpage = await fallback.newPage();
  fpage.on("pageerror", (error) => pageErrors.push(error.message));
  await fpage.goto(base);
  await fpage.waitForFunction(() =>
    document.getElementById("engineStatus").textContent.includes("kunne ikke"),
  );
  await fpage.locator("#simulate").click();
  await fpage.waitForFunction(() =>
    document.getElementById("flightSummary").textContent.includes("m"),
  );
  assert.equal(await fpage.locator("#fallback").isVisible(), true);
  await fpage.screenshot({ path: "test-results/mobile-2d.png" });
  await fallback.close();
  results.push("2D-fallback fungerer uden WebGL");
  assert.deepEqual(pageErrors, []);
  await writeFile(
    "test-results/browser-results.json",
    JSON.stringify({ results, pageErrors, messages }, null, 2),
  );
  console.log(results.join("\n"));
} catch (error) {
  await page.screenshot({ path: "test-results/failure.png" });
  console.error({
    results,
    pageErrors,
    messages: [...new Set(messages)].slice(0, 10),
  });
  throw error;
} finally {
  await browser.close();
  server?.httpServer.close();
}
