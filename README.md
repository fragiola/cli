# fragiola

The Fragiola CLI. Its `fragiola mcp` command is an [MCP](https://modelcontextprotocol.io) server
that gives AI agents (Claude Code, Cursor, VS Code, Codex, OpenCode, …) everything
[fragiola.com](https://fragiola.com) documents: which components exist, their docs, the libraries'
APIs and how to install each.

Fragiola has **two kinds of components**, and the server always says which one an item is:

| kind            | what it is                                                                                                                 | how it is used                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Fragiola UI** | components as **source code**, distributed through the shadcn registry (Base UI + Tailwind v4)                             | `npx shadcn@latest add @fragiola/<name>`: the code is copied into the project, which owns it                   |
| **Libraries**   | headless **npm packages**: a core `@fragiola/<x>` and adapters `@fragiola/<x>-react` (Dockable, Data Grid, Grid Layout, …) | `npm install @fragiola/<x>-react` (the adapter for your framework, which brings the core), then import from it |

## Setup

Run this in your project to configure your AI client:

```bash
npx fragiola@latest mcp init --client <client>
```

Without `--client`, it asks which client to configure, or fails with the list when no one can
answer. It merges into an existing config file and keeps your other servers. Running it again
changes nothing. It never overwrites a file that is not valid JSON.

| client      | `--client` | what it does                                                                                                    |
| ----------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| Claude Code | `claude`   | writes `.mcp.json`. Restart Claude Code and approve the server (`/mcp` shows it)                                |
| Cursor      | `cursor`   | writes `.cursor/mcp.json`. Enable the server in Cursor Settings → MCP                                           |
| VS Code     | `vscode`   | writes `.vscode/mcp.json`. Click Start next to the server, then use Copilot Chat in agent mode                  |
| OpenCode    | `opencode` | writes `opencode.json`. Restart OpenCode                                                                        |
| Codex       | `codex`    | prints the block for `~/.codex/config.toml`. Codex keeps its servers outside the project, so nothing is written |

`fragiola` is not added to your dependencies: every client runs `npx fragiola@latest mcp`, so
it always uses the latest server.

### Manual configuration

Claude Code (`.mcp.json`) and Cursor (`.cursor/mcp.json`):

```json
{
    "mcpServers": {
        "fragiola": { "command": "npx", "args": ["fragiola@latest", "mcp"] }
    }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
    "servers": {
        "fragiola": { "command": "npx", "args": ["fragiola@latest", "mcp"] }
    }
}
```

OpenCode (`opencode.json`):

```json
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "fragiola": {
            "type": "local",
            "command": ["npx", "fragiola@latest", "mcp"],
            "enabled": true
        }
    }
}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.fragiola]
command = "npx"
args = ["fragiola@latest", "mcp"]
```

### Example prompts

- "Which Fragiola components exist for forms?"
- "Add a Fragiola select to this form, styled with the palette roles."
- "Which Fragiola library gives me dockable panels, and how do I install it?"
- "Show me Dockable's Tab primitive API."
- "Build a dashboard with @fragiola/grid-layout and Fragiola UI cards."

### Troubleshooting

- **The server does not respond.** Run `npx fragiola@latest mcp` in a terminal: it should wait
  silently for input (press Ctrl+C to stop). Check that Node.js 24 or later is on the client's
  `PATH`, then restart the client.
- **"does not serve the Fragiola agent index".** The server cannot read `/agents/index.json`.
  Check `FRAGIOLA_URL` (unset it to use fragiola.com) and the network.
- **"is not valid JSON".** `mcp init` reads plain JSON only. A config file with comments (JSONC,
  common in `.vscode/mcp.json` and `opencode.json`) is left untouched: add the entry by hand from
  [Manual configuration](#manual-configuration).
- **No tools listed.** Make sure the client enabled the `fragiola` server, and restart it after
  `mcp init`.
- **Outdated answers.** Responses are cached for one session: restart the server (or the client).

## MCP server

```bash
npx fragiola@latest mcp
```

It speaks MCP over stdio. Nothing but the protocol is written to stdout. Logs go to stderr.

### Tools

| tool                    | answers                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_fragiola_overview` | what Fragiola is, the two kinds, every project. Start here                                                                                                   |
| `list_projects`         | the projects, their kind, packages and how to install each                                                                                                   |
| `list_components`       | Fragiola UI components and the libraries' API entries, filtered by kind, project or group, paginated                                                         |
| `search_fragiola`       | fuzzy search over components and every docs page                                                                                                             |
| `get_component`         | details of named components or libraries; `include_code` returns a UI component's source                                                                     |
| `get_docs`              | a project's page list, or one page as Markdown                                                                                                               |
| `get_api`               | a library's API reference pages                                                                                                                              |
| `get_install_command`   | the exact commands: the `components.json` registry and `shadcn add` for UI, one `npm install <adapter>` per framework for libraries (`framework` narrows it) |

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
