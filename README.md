# fragiola

The Fragiola CLI. Its `fragiola mcp` command is an [MCP](https://modelcontextprotocol.io) server
that gives AI agents (Claude Code, Cursor, VS Code, Codex, OpenCode, …) everything
[fragiola.com](https://fragiola.com) documents: which components exist, their docs, the libraries'
APIs and how to install each.

Fragiola has **two kinds of components**, and the server always says which one an item is:

| kind            | what it is                                                                                                                 | how it is used                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Fragiola UI** | components as **source code**, distributed through the shadcn registry (Base UI + Tailwind v4)                             | `npx shadcn@latest add @fragiola/<name>`: the code is copied into the project, which owns it |
| **Libraries**   | headless **npm packages**: a core `@fragiola/<x>` and adapters `@fragiola/<x>-react` (Dockable, Data Grid, Grid Layout, …) | `npm install @fragiola/<x> @fragiola/<x>-react`, then import them                            |

## MCP server

```bash
npx fragiola@latest mcp
```

It speaks MCP over stdio. Nothing but the protocol is written to stdout. Logs go to stderr.

### Tools

| tool                    | answers                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `get_fragiola_overview` | what Fragiola is, the two kinds, every project. Start here                                              |
| `list_projects`         | the projects, their kind, packages and how to install each                                              |
| `list_components`       | Fragiola UI components and the libraries' API entries, filtered by kind, project or group, paginated    |
| `search_fragiola`       | fuzzy search over components and every docs page                                                        |
| `get_component`         | details of named components or libraries; `include_code` returns a UI component's source                |
| `get_docs`              | a project's page list, or one page as Markdown                                                          |
| `get_api`               | a library's API reference pages                                                                         |
| `get_install_command`   | the exact commands: the `components.json` registry and `shadcn add` for UI, `npm install` for libraries |

The server also sends `instructions` at initialize, so the agent knows the two kinds before it
calls anything.

### Where the content comes from

Every answer comes from fragiola.com's **agent index** (`/agents/index.json`, the Markdown pages
under `/agents/`, and the registry under `/r/`). It is fetched when a tool needs it and cached for
the session, so new components and pages show up without upgrading the CLI. The format is
[`docs/agent-index.md`](docs/agent-index.md).

| variable       | default                | use                                                                                           |
| -------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `FRAGIOLA_URL` | `https://fragiola.com` | read another site, for example a local build of fragiola.com (`pnpm serve` in `fragiola/www`) |

### Embedding

```ts
import { createServer } from "fragiola/mcp";

const server = createServer({ baseUrl: "https://fragiola.com" });
```

`createServer` returns an `McpServer` from `@modelcontextprotocol/server` (v2): connect it to any
transport.

## Development

```bash
pnpm install
pnpm test          # build, then the unit, in-process and stdio tests (no network)
pnpm mcp:inspect   # the MCP Inspector on the built server
```

See [AGENTS.md](AGENTS.md) for the repository's rules.

## License

MIT
