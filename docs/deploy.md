# Deploying evergarden

Every evergarden instance is one Worker on the owner's Cloudflare account, with its own D1 database. Nothing in the repository points at a specific account: the configuration names the resources, and Wrangler creates them on the first deploy.

There are two ways to get an instance. Pick the first if you want to run evergarden; pick the second if you develop it and want each push to `main` deployed.

## Option 1: the Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/felipeadeildo/evergarden)

The button copies this repository into your GitHub account, creates the database, asks for the secrets (with the descriptions in `package.json` under `cloudflare.bindings`), and deploys. Your copy is connected to Workers Builds, so pushing to it deploys again.

Before you click, set up email, because evergarden signs you in with a code sent by Cloudflare Email Service (see [Sign-in codes by email](#sign-in-codes-by-email)).

## Option 2: connect your own repository with Workers Builds

Use this when the repository is yours and every commit on `main` should go live.

1. Run the first deploy from your machine, logged in to the right account:

   ```sh
   bunx wrangler login          # check the account with `bunx wrangler whoami`
   bun run deploy
   ```

   `wrangler deploy` creates the `evergarden` database, then `db:migrate:remote` creates the tables.

2. Set up email as described in [Sign-in codes by email](#sign-in-codes-by-email).

3. Set the secrets listed in [`.dev.vars.example`](../.dev.vars.example), in the dashboard under **Workers & Pages > evergarden > Settings > Variables and Secrets**, or one by one:

   ```sh
   bunx wrangler secret put BETTER_AUTH_SECRET
   ```

4. In the same Worker, open **Settings > Builds > Connect**, pick the repository, and set:

   | Field             | Value                 |
   | ----------------- | --------------------- |
   | Production branch | `main`                |
   | Build command     | `bun run build`       |
   | Deploy command    | `npx wrangler deploy` |

   The Worker name in the dashboard must stay `evergarden`, the `name` in `wrangler.jsonc`, or the build fails.

From then on, a push to `main` builds and deploys, and pushes to other branches produce preview URLs.

## Sign-in codes by email

There are no passwords and no GitHub or Google sign-in. You type your email on `/sign-in`, the Worker sends a six-digit code through the `send_email` binding in `wrangler.jsonc`, and you type the code. Codes go only to `OWNER_EMAIL` and to the guests of what you share; any other address sees the same screen and receives nothing.

1. Your domain must use Cloudflare DNS. In the dashboard, open **Compute > Email Service > Email Sending**, onboard the domain, and let Cloudflare add the DNS records it asks for.
2. Set `EMAIL_FROM` to an address on that domain, such as `evergarden@example.com`.
3. Choose how the codes are paid for:
   - **Workers Free.** Email can go only to verified destination addresses, and only from a domain with Email Routing turned on. Turn on Email Routing for the domain, then under **Email Routing > Destination addresses** add `OWNER_EMAIL` and click the link Cloudflare sends. Codes to a verified address are free and do not count toward any quota. Email Routing replaces the domain's MX records, so if the domain already receives mail elsewhere, send from a subdomain such as `mail.example.com` instead.
   - **Workers Paid.** Codes can go to any address, which guests need to sign in. The plan includes 3,000 emails a month; more cost $0.35 per thousand.

Email Sending has been in public beta since April 2026, and new accounts start with a low daily quota that grows over time. If a code does not arrive, check the spam folder first; the Worker logs a failed send as `Sign-in code not sent:` with Cloudflare's error code.

In `bun run dev` nothing is sent: the terminal prints `[evergarden] sign-in code for …`, and the simulated email is saved under `.wrangler/tmp/email/`.

## The instance's address

An instance answers only on a custom domain: `wrangler.jsonc` turns off the `*.workers.dev` address and preview URLs, because sign-in accepts one address, the one in `BETTER_AUTH_URL`. Add the domain under **Workers & Pages > evergarden > Settings > Domains & Routes**, then set `BETTER_AUTH_URL` to it. Email sign-in already needs a domain on Cloudflare, so the same one works.

## What a deploy changes, and what it leaves alone

A deploy replaces the code and the bindings declared in `wrangler.jsonc`. It does not touch secrets, and because the configuration sets `keep_vars: true`, it does not touch plain variables set in the dashboard either. Anything that differs between instances (the owner, the sender address, the public URL) therefore lives in the dashboard, never in the repository.

## Migrations run in the build

On Workers Builds, where `WORKERS_CI` is `1`, `bun run build` applies pending D1 migrations before the deploy command uploads the new code. A local build never touches a database. The Deploy to Cloudflare button copies the build command from `package.json`, so its instances migrate the same way.

The first deploy from your machine (option 2) is the exception: the database exists only after `wrangler deploy` creates it, so `bun run deploy` migrates after deploying.

When a migration fails, the build stops and the old version keeps running. Keep each migration safe for the code before it: add tables and columns in one release, and drop old ones in a later release.
