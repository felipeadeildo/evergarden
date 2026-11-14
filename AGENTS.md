# Working on evergarden

Read [docs/design.md](docs/design.md) before changing server code and [docs/design-language.md](docs/design-language.md) before changing anything visible.

## Rules

- Everything in the repository is in English: code, comments, docs, commit messages.
- Use Bun for everything: `bun install`, `bun run <script>`, `bunx <tool>`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`), with a scope when one module is touched: `feat(render): support callouts`.
- Keep the module boundaries in [docs/design.md](docs/design.md#modules). Server functions, `/api/v1` and `/mcp` stay thin; rules live in `src/server/*`.
- Every server function, API route and MCP tool that touches a document calls `authorize`.
- Load the `technical-writing` and `writing-for-humans` skills before writing docs.

## Linting and formatting

- After making code changes, run `bunx oxlint --fix`, then `bunx oxfmt`.
- Before finishing, run `bun run check`.
