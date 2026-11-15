import { Command } from "commander";
import { pkg } from "./lib/package.ts";

/** Builds the `fragiola` program. Subcommands are registered here. */
export function createProgram(): Command {
    const program = new Command()
        .name("fragiola")
        .description(
            "The Fragiola CLI. Gives AI agents Fragiola UI (source components) and the Fragiola libraries (npm packages) through an MCP server.",
        )
        .version(pkg.version, "-v, --version", "print the version");

    return program;
}
