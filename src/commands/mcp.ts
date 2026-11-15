import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { Command } from "commander";
import { log } from "../lib/log.ts";
import { createServer } from "../mcp/index.ts";
import { mcpInitCommand } from "./mcp-init.ts";

/** `fragiola mcp`: serves the Fragiola MCP server over stdio. */
export function mcpCommand(): Command {
    return (
        new Command("mcp")
            .description(
                "Start the Fragiola MCP server (stdio) for AI agents: Fragiola UI components (source code) and the Fragiola libraries (npm packages), their docs and APIs.",
            )
            .option("-c, --cwd <dir>", "the working directory", process.cwd())
            // `--cwd` after `init` belongs to init, not to mcp.
            .enablePositionalOptions()
            .addCommand(mcpInitCommand())
            .action((options: { cwd: string }) => {
                if (options.cwd !== process.cwd()) process.chdir(options.cwd);
                serveStdio(() => createServer(), {
                    onerror: (error) =>
                        log.error(
                            `[fragiola mcp] ${error instanceof Error ? error.message : String(error)}`,
                        ),
                });
            })
    );
}
