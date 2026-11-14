# evergarden

A place to publish what your agents write, and review it like a pull request.

Your agent publishes a markdown document (a report, a plan, a spec) over MCP. You read it in a page made for reading, select a passage, comment or suggest a rewrite, and submit a review. The agent reads the review, publishes a new revision, and answers each comment. A share link lets anyone else read it, or comment after signing in.

It runs on Cloudflare: one Worker with TanStack Start, D1 for everything it stores. Each instance belongs to one person and lives on their own Cloudflare account.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/felipeadeildo/evergarden)

> evergarden is early. The design is settled; the code is being built step by step, following the [roadmap](docs/roadmap.md).

## Documentation

- [How evergarden is used](docs/flows.md): every flow, from publishing to sharing
- [Design](docs/design.md): decisions, modules, data, security
- [Design language](docs/design-language.md): colour, type, layout, motion
- [Deploying](docs/deploy.md): the Deploy button, or your own repository with Workers Builds
- [Roadmap](docs/roadmap.md)

## Development

You need [Bun](https://bun.sh) 1.3 or newer.

```sh
bun install                 # dependencies and git hooks
bun run db:migrate:local    # apply migrations to the local D1
bun run dev                 # http://localhost:3000
bun run check               # format check, lint with type checking, tests
```

Copy `.dev.vars.example` to `.dev.vars` and fill it in before the first `dev`.

Commits follow [Conventional Commits](https://www.conventionalcommits.org); a `commit-msg` hook checks them.

## Licence

[MIT](LICENSE). Paper Mono is distributed under the [SIL Open Font License](public/fonts/paper-mono-OFL.txt).
