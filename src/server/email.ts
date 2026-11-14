import { env, waitUntil } from "cloudflare:workers";

/**
 * Emails a sign-in code through Cloudflare Email Service. The request returns before the email
 * goes out, so the response time does not reveal whether the address has an account. In local
 * development the binding sends nothing, so the code is also printed in the terminal.
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
