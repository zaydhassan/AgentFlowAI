// Verify the enlarged hero workflow: truncation, page overflow, rendered size.
const { chromium } = require("./node_modules/playwright-core");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const vis = { locator: 'svg[aria-label*="Example agent workflow"]' };

  for (const [name, width, height] of [["1440", 1440, 900], ["1280", 1280, 900], ["1100", 1100, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3500);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('svg[aria-label*="Example agent workflow"]');
      const r = svg.getBoundingClientRect();
      const clipped = [...document.querySelectorAll("svg foreignObject span.truncate")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent.trim());
      const de = document.documentElement;
      return {
        svgW: Math.round(r.width),
        svgH: Math.round(r.height),
        clipped,
        hOverflow: de.scrollWidth - de.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      };
    });
    console.log(`${name}px: svg=${m.svgW}x${m.svgH} clipped=${JSON.stringify(m.clipped)} hOverflow=${m.hOverflow}/${m.bodyOverflow}`);
    await page.screenshot({ path: `claude-shots/size-${name}.png` });
    await page.close();
  }

  // Mobile
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mob.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 90000 });
  await mob.waitForTimeout(3500);
  const mm = await mob.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label*="Example agent workflow"]')];
    const svg = svgs[1] || svgs[0];
    const r = svg.getBoundingClientRect();
    const clipped = [...svg.querySelectorAll("foreignObject span.truncate")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim());
    const de = document.documentElement;
    return { svgW: Math.round(r.width), svgH: Math.round(r.height), clipped, hOverflow: de.scrollWidth - de.clientWidth };
  });
  console.log(`390px(mobile svg): ${mm.svgW}x${mm.svgH} clipped=${JSON.stringify(mm.clipped)} hOverflow=${mm.hOverflow}`);
  await mob.locator(vis.locator).nth(1).screenshot({ path: "claude-shots/size-390.png" });
  await mob.close();

  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });