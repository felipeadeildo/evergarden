# Deploying evergarden

Every evergarden instance is one Worker on the owner's Cloudflare account, with its own D1 database. Nothing in the repository points at a specific account: the configuration names the resources, and Wrangler creates them on the first deploy.

There are two ways to get an instance. Pick the first if you want to run evergarden; pick the second if you develop it and want each push to `main` deployed.

## Option 1: the Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/felipeadeildo/evergarden)

The button copies this repository into your GitHub account, creates the database, asks for the secrets (with the descriptions in `package.json` under `cloudflare.bindings`), and deploys. Your copy is connected to Workers Builds, so pushing to it deploys again.

Before you click, create a GitHub OAuth app at <https://github.com/settings/developers>. Its callback URL is `https://<worker-name>.<your-subdomain>.workers.dev/api/auth/callback/github`; you can change it later if you add a custom domain.

## Option 2: connect your own repository with Workers Builds

Use this when the repository is yours and every commit on `main` should go live.

1. Run the first deploy from your machine, logged in to the right account:

   ```sh
   bunx wrangler login          # check the account with `bunx wrangler whoami`
   bun run deploy
   ```

   `wrangler deploy` creates the `evergarden` database, then `db:migrate:remote` creates the tables.

2. Set the secrets listed in [`.dev.vars.example`](../.dev.vars.example), in the dashboard under **Workers & Pages > evergarden > Settings > Variables and Secrets**, or one by one:

   ```sh
   bunx wrangler secret put BETTER_AUTH_SECRET
   ```

3. In the same Worker, open **Settings > Builds > Connect**, pick the repository, and set:

   | Field             | Value            |
   | ----------------- | ---------------- |
   | Production branch | `main`           |
   | Build command     | (empty)          |
   | Deploy command    | `bun run deploy` |

   The Worker name in the dashboard must stay `evergarden`, the `name` in `wrangler.jsonc`, or the build fails.

From then on, a push to `main` builds and deploys, and pushes to other branches produce preview URLs.

## What a deploy changes, and what it leaves alone

A deploy replaces the code and the bindings declared in `wrangler.jsonc`. It does not touch secrets, and because the configuration sets `keep_vars: true`, it does not touch plain variables set in the dashboard either. Anything that differs between instances (the owner, OAuth credentials, the public URL) therefore lives in the dashboard, never in the repository.

## Migrations run after the code

`bun run deploy` deploys the Worker first and applies migrations second, because on a first deploy the database does not exist until `wrangler deploy` creates it. For a few seconds after each deploy, the new code runs against the old schema. Write migrations so that this is safe: add tables and columns in one release, and start depending on them, or drop old ones, in a later release.
