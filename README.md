# evergarden

A self-hosted Claude Artifacts for what your agents write.

Your agent publishes a plan, a report or a spec over MCP. You read it on a page made for reading, comment on a passage like in Google Docs, and the agent answers and publishes the next version. Share a document or a folder with a link, or with a list of emails, and others read it or comment too.

**See one live:** [evergarden.adeildo.dev/d/rgcczz32ix](https://evergarden.adeildo.dev/d/rgcczz32ix), the story of why it exists, published from my own instance.

It is one Cloudflare Worker (TanStack Start, D1), on your own account, for one person.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/felipeadeildo/evergarden)

## Connect an agent

```sh
pi mcp add evergarden --url https://<your-instance>/mcp
```

The agent signs in with OAuth the first time. Settings shows the same command for Claude Code, Codex and Gemini CLI, and API keys for clients without OAuth.

## Docs

- [How it is used](docs/flows.md)
- [Design](docs/design.md) and [design language](docs/design-language.md)
- [Deploying](docs/deploy.md)
- [Roadmap](docs/roadmap.md)

## Development

With [Bun](https://bun.sh) 1.3 or newer, and `.dev.vars` copied from `.dev.vars.example`:

```sh
bun install
bun run db:migrate:local
bun run dev     # http://localhost:3000
bun run check   # format, lint, types, tests
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Licence

[MIT](LICENSE). Paper Mono is under the [SIL Open Font License](public/fonts/paper-mono-OFL.txt).
