import { env, waitUntil } from "cloudflare:workers";

/**
 * Returns before the email goes out, so the response time does not reveal which addresses can
 * sign in. `bun run dev` sends nothing, so the code is also printed.
 */
export function sendSignInCode(email: string, code: string): void {
  if (import.meta.env?.DEV) console.log(`[evergarden] sign-in code for ${email}: ${code}`);
  waitUntil(
    env.EMAIL.send({
      to: email,
      from: { email: env.EMAIL_FROM, name: "evergarden" },
      subject: `${code} is your evergarden code`,
      text: [
        `Your sign-in code is ${code}.`,
        "",
        "It works once, for the next 10 minutes. If you did not try to sign in, ignore this email.",
      ].join("\n"),
    }).catch((error: unknown) => {
      console.error("Sign-in code not sent:", error instanceof Error ? error.message : error);
    }),
  );
}
