// Renders the brand images from their sources: public/icon.svg and brand/banner.html.
// Usage: bun scripts/brand.ts
import { resolve } from "node:path";

import { chromium } from "playwright";

const browser = await chromium.launch();

async function render(url: string, file: string, width: number, height: number, scale = 1) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
  await page.close();
  console.log(file);
}

const icon = `file://${resolve("public/icon.svg")}`;
for (const size of [180, 192, 512]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  await render(icon, `public/${name}`, size, size);
}

const banner = `file://${resolve("brand/banner.html")}`;
await render(banner, "brand/banner.png", 1280, 640, 2);
await render(banner, "public/og.png", 1200, 630);

await browser.close();
