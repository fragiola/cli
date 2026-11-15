import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Command, Option } from "commander";
import { mergeJsonFile } from "../lib/json-file.ts";
import { log } from "../lib/log.ts";

/** The command every client runs: always the latest published CLI. */
export const SERVER_COMMAND = {
    command: "npx",
    args: ["fragiola@latest", "mcp"],
} as const;

export type Client = {
    name: string;
    label: string;
    /** The project file to write, or none (the client keeps its config elsewhere). */
    configPath?: string;
    config?: Record<string, unknown>;
    /** Where the fragiola server sits in `config`: replaced wholesale on every run. */
    entry?: readonly string[];
    /** What to tell the user after writing (or instead of writing). */
    next: string;
};

export const CLIENTS: readonly Client[] = [
    {
        name: "claude",
        label: "Claude Code",
        configPath: ".mcp.json",
        entry: ["mcpServers", "fragiola"],
        config: {
            mcpServers: {
                fragiola: { ...SERVER_COMMAND, args: [...SERVER_COMMAND.args] },
            },
        },
        next: "Restart Claude Code and approve the fragiola server (/mcp shows its status).",
    },
    {
        name: "cursor",
        label: "Cursor",
        configPath: ".cursor/mcp.json",
        entry: ["mcpServers", "fragiola"],
        config: {
            mcpServers: {
                fragiola: { ...SERVER_COMMAND, args: [...SERVER_COMMAND.args] },
            },
        },
        next: "Open Cursor Settings → MCP and enable the fragiola server.",
    },
    {
        name: "vscode",
        label: "VS Code",
        configPath: ".vscode/mcp.json",
        entry: ["servers", "fragiola"],
        config: {
            servers: {
                fragiola: { ...SERVER_COMMAND, args: [...SERVER_COMMAND.args] },
            },
        },
        next: "Open .vscode/mcp.json and click Start next to the fragiola server, then use Copilot Chat in agent mode.",
    },
    {
        name: "opencode",
        label: "OpenCode",
        configPath: "opencode.json",
        entry: ["mcp", "fragiola"],
        config: {
            $schema: "https://opencode.ai/config.json",
            mcp: {
                fragiola: {
                    type: "local",
                    command: [SERVER_COMMAND.command, ...SERVER_COMMAND.args],
                    enabled: true,
                },
            },
        },
        next: "Restart OpenCode.",
    },
    {
        name: "codex",
        label: "Codex",
        next: [
            "Codex keeps its MCP servers in ~/.codex/config.toml, outside the project. Add:",
            "",
            "[mcp_servers.fragiola]",
            `command = "${SERVER_COMMAND.command}"`,
            `args = [${SERVER_COMMAND.args.map((arg) => `"${arg}"`).join(", ")}]`,
            "",
            "Then restart Codex.",
        ].join("\n"),
    },
];

export const clientNames = CLIENTS.map((client) => client.name);

export type InitOptions = {
    client?: string;
    cwd: string;
    /** Whether a human can answer a prompt (defaults to stdin and stderr being TTYs). */
    interactive?: boolean;
    /** Where messages go (stderr by default). */
    print?: (message: string) => void;
    /** Asks the user to choose a client; returns its name. */
    prompt?: () => Promise<string>;
};

async function promptClient(): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
    });
    try {
        process.stderr.write(
            "Which MCP client should use the Fragiola MCP server?\n",
        );
        CLIENTS.forEach((client, index) => {
            process.stderr.write(
                `  ${index + 1}. ${client.label} (${client.name})\n`,
            );
        });
        for (;;) {
            const answer = (await rl.question(`Choose 1-${CLIENTS.length}: `))
                .trim()
                .toLowerCase();
            const byNumber = CLIENTS[Number(answer) - 1];
            const chosen =
                byNumber ?? CLIENTS.find((client) => client.name === answer);
            if (chosen) return chosen.name;
        }
    } finally {
        rl.close();
    }
}

/**
 * Writes (or merges) the client's MCP config in the project. Returns the file
 * written, or `undefined` for a client configured outside the project.
 */
export async function initClient(
    options: InitOptions,
): Promise<string | undefined> {
    const print = options.print ?? log.info;
    const interactive =
        options.interactive ??
        Boolean(process.stdin.isTTY && process.stderr.isTTY);
    let name = options.client?.trim().toLowerCase();
    if (!name) {
        if (!interactive) {
            throw new Error(
                `Choose a client with --client: ${clientNames.join(", ")}.`,
            );
        }
        name = await (options.prompt ?? promptClient)();
    }
    const client = CLIENTS.find((candidate) => candidate.name === name);
    if (!client) {
        throw new Error(
            `Unknown client "${name}". Use one of: ${clientNames.join(", ")}.`,
        );
    }
    if (!client.configPath || !client.config) {
        print(client.next);
        return undefined;
    }
    const file = resolve(options.cwd, client.configPath);
    await mergeJsonFile(file, client.config, client.entry);
    print(
        `Configured the Fragiola MCP server for ${client.label} in ${client.configPath}.`,
    );
    print(client.next);
    return file;
}

/** `fragiola mcp init`: configures an AI client to use the Fragiola MCP server. */
export function mcpInitCommand(): Command {
    return new Command("init")
        .description(
            "Configure an AI client to use the Fragiola MCP server in this project.",
        )
        .addOption(
            new Option("--client <client>", "the MCP client").choices(
                clientNames,
            ),
        )
        .option("-c, --cwd <dir>", "the project directory", process.cwd())
        .action(async (options: { client?: string; cwd: string }) => {
            await initClient({
                cwd: options.cwd,
                ...(options.client ? { client: options.client } : {}),
            });
        });
}
