// Screenshot the redesigned hero workflow at desktop + mobile sizes.
const { chromium } = require("./node_modules/playwright-core");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });

  const vis = { locator: 'svg[aria-label*="Example agent workflow"]' };
  // Desktop
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "claude-shots/wf-desktop-full.png" });
  await page.locator(vis.locator).first().screenshot({ path: "claude-shots/wf-desktop-close.png" });
  await page.close();

  // Tablet-ish width (lg breakpoint)
  const tab = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
  await tab.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  await tab.waitForTimeout(4000);
  await tab.locator(vis.locator).first().screenshot({ path: "claude-shots/wf-tablet.png" });
  await tab.close();

  // Mobile — the visible svg here is the second (mobile) composition
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mob.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  await mob.waitForTimeout(4000);
  await mob.locator(vis.locator).nth(1).screenshot({ path: "claude-shots/wf-mobile.png" });
  await mob.screenshot({ path: "claude-shots/wf-mobile-full.png" });
  await mob.close();

  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });