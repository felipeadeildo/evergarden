// Captures pages of a running dev server at desktop and phone sizes, signed in as the owner.
// Usage: bun scripts/screenshots.ts <email> <password> <path>... (output in .screenshots/)
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const [email, password, ...paths] = process.argv.slice(2);
if (!email || !password || paths.length === 0) {
  console.error("Usage: bun scripts/screenshots.ts <email> <password> <path>...");
  process.exit(1);
}

const base = process.env.BASE_URL ?? "http://localhost:3000";
const sizes = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch();
for (const scheme of ["light", "dark"] as const) {
  for (const size of sizes) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      isMobile: size.mobile,
      hasTouch: size.mobile,
      colorScheme: scheme,
    });
    const response = await context.request.post(`${base}/api/auth/sign-in/email`, {
      data: { email, password },
      headers: { origin: base },
    });
    if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error(`[${size.name}] ${error.message}`));
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const slug = path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
      const file = `.screenshots/${slug}-${size.name}-${scheme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
