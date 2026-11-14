// Captures pages of a running dev server at desktop and phone sizes, signed in as the owner.
// Usage: bun scripts/screenshots.ts <owner-email> <path>... (output in .screenshots/)
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { type BrowserContext, chromium } from "playwright";

const [email, ...paths] = process.argv.slice(2);
if (!email || paths.length === 0) {
  console.error("Usage: bun scripts/screenshots.ts <owner-email> <path>...");
  process.exit(1);
}

const base = process.env.BASE_URL ?? "http://localhost:3000";
const sizes = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

/** The newest sign-in email that `bun run dev` saved instead of sending. */
function latestCode(): string {
  const root = ".wrangler/tmp/email";
  const files = readdirSync(root).flatMap((run) => {
    const dir = join(root, run, "email-text");
    try {
      return readdirSync(dir).map((name) => join(dir, name));
    } catch {
      return [];
    }
  });
  const newest = files.toSorted((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  const code = newest && /\b(\d{6})\b/.exec(readFileSync(newest, "utf8"))?.[1];
  if (!code) throw new Error(`No sign-in code found under ${root}`);
  return code;
}

async function signIn(context: BrowserContext): Promise<void> {
  const headers = { origin: base };
  await context.request.post(`${base}/api/auth/email-otp/send-verification-otp`, {
    data: { email, type: "sign-in" },
    headers,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const response = await context.request.post(`${base}/api/auth/sign-in/email-otp`, {
    data: { email, otp: latestCode() },
    headers,
  });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
}

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
    await signIn(context);
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
