# fragiola — the Fragiola CLI

The `fragiola` npm package. Today it has one command, `fragiola mcp`, an MCP server (stdio) that
gives AI agents an agent-facing view of fragiola.com: the components, their docs, the libraries'
APIs and how to install each. `fragiola/mcp` exports the same server for embedding.

Fragiola has **two kinds of components**, and every output of this CLI keeps them apart:

- **Fragiola UI** (`kind: "registry"`): source code distributed through the shadcn registry
  (`npx shadcn@latest add @fragiola/<name>`). The developer copies it and owns it.
- **Libraries** (`kind: "library"`): headless npm packages, a core `@fragiola/<x>` plus framework
  adapters `@fragiola/<x>-react`, installed and imported.

The ecosystem guidelines live in `../guidelines` (or the `fragiola-ecosystem` skill). This file
wins for this repository.

## Non-negotiable rules

1. **This is a CLI, not a Fragiola library.** Core + adapters, the model API
   (`run`/`can`/`check`/`get`/`is`), the primitive contract and the site export do not apply.
   Plain functions and modules; add structure only when the code asks for it.
2. **stdout belongs to the protocol.** While `fragiola mcp` runs, stdout carries MCP messages
   only. Every log, warning and error goes through `src/lib/log.ts` (stderr). Never
   `console.log`.
3. **The content comes only from the agent index.** Everything the tools say about components,
   pages and packages is read from fragiola.com's agent index (`docs/agent-index.md`), never
   hard-coded. The only fixed text is about Fragiola as a whole (the server instructions, the two
   kinds, the install flows).
4. **The contract is `docs/agent-index.md`.** `src/content/schema.ts` matches it field for field.
   A change to one is a change to both, and to `fragiola/www`, which emits the index.
5. **Tests never touch the network.** They serve `tests/fixtures/site/` from a local HTTP server
   and point `FRAGIOLA_URL` at it.
6. **Outputs are for agents.** Plain Markdown, stable order, no ANSI, always saying whether an
   item is source code or an npm library and what to call or run next.

## Commands

| command                    | does                                                                           |
| -------------------------- | ------------------------------------------------------------------------------ |
| `pnpm install`             | install dependencies                                                           |
| `pnpm build`               | tsdown → `dist/` (`cli.mjs` is the bin, `index.mjs` and `mcp.mjs` the exports) |
| `pnpm dev -- <args>`       | run the CLI from source (Node type stripping)                                  |
| `pnpm test`                | build, then Vitest (unit, in-process MCP and the stdio end-to-end tests)       |
| `pnpm check` / `check:fix` | Biome lint + format                                                            |
| `pnpm typecheck`           | TypeScript 7, no emit                                                          |
| `pnpm mcp:inspect`         | build and open the MCP Inspector on `fragiola mcp`                             |

## Layout

```
src/cli.ts           the bin: parses argv and runs the program
src/program.ts       the commander program; subcommands are registered here
src/index.ts         the `fragiola` export (no side effects)
src/commands/        one file per command
src/content/         the agent index: schema, fetcher, catalog queries
src/mcp/             the MCP server (`fragiola/mcp`), its tools and formatters
src/lib/             small shared helpers (log, package metadata, JSON files)
tests/               Vitest, mirroring src/; fixtures and the local server in tests/
docs/agent-index.md  the contract fragiola.com emits
```

## Conventions

- Toolchain: pnpm 11, Node ≥ 24, TypeScript 7 strict (`noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, erasable syntax only, relative imports with `.ts`), tsdown, Vitest,
  Biome (4-space indent, double quotes, LF, organized imports).
- Dependencies pinned to exact versions published at least 7 days ago (`minimumReleaseAge`).
- Commits are gitmoji-conventional (`✨ feat: …`, `🐛 fix: …`, `✅ test: …`, `🔧 chore: …`,
  `👷 ci: …`, `📝 docs: …`). Code, docs and commits in English.
- Branches `<type>/epic-<n>-…`, worktrees under `.worktrees/`.
- Publishing is not wired yet. Nobody publishes by hand.
