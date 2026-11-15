import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENTS, initClient } from "../../src/commands/mcp-init.ts";

const bin = fileURLToPath(new URL("../../dist/cli.mjs", import.meta.url));
let cwd: string;
let printed: string[];

beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "fragiola-init-"));
    printed = [];
});

afterEach(() => rm(cwd, { recursive: true, force: true }));

const init = (
    client?: string,
    extra: Partial<Parameters<typeof initClient>[0]> = {},
) =>
    initClient({
        cwd,
        interactive: false,
        print: (message) => printed.push(message),
        ...(client ? { client } : {}),
        ...extra,
    });

const readJson = async (path: string) =>
    JSON.parse(await readFile(join(cwd, path), "utf8")) as unknown;

describe("fragiola mcp init", () => {
    it.each([
        [
            "claude",
            ".mcp.json",
            {
                mcpServers: {
                    fragiola: {
                        command: "npx",
                        args: ["fragiola@latest", "mcp"],
                    },
                },
            },
        ],
        [
            "cursor",
            ".cursor/mcp.json",
            {
                mcpServers: {
                    fragiola: {
                        command: "npx",
                        args: ["fragiola@latest", "mcp"],
                    },
                },
            },
        ],
        [
            "vscode",
            ".vscode/mcp.json",
            {
                servers: {
                    fragiola: {
                        command: "npx",
                        args: ["fragiola@latest", "mcp"],
                    },
                },
            },
        ],
        [
            "opencode",
            "opencode.json",
            {
                $schema: "https://opencode.ai/config.json",
                mcp: {
                    fragiola: {
                        type: "local",
                        command: ["npx", "fragiola@latest", "mcp"],
                        enabled: true,
                    },
                },
            },
        ],
    ])("writes the %s config", async (client, path, expected) => {
        expect(await init(client)).toBe(join(cwd, path));
        expect(await readJson(path)).toEqual(expected);
        const text = await readFile(join(cwd, path), "utf8");
        expect(text.endsWith("}\n")).toBe(true);
        expect(text).toContain('\n  "');
        expect(printed.join("\n")).toContain(`in ${path}`);
    });

    it("prints the codex TOML and writes nothing", async () => {
        expect(await init("codex")).toBeUndefined();
        const text = printed.join("\n");
        expect(text).toContain("~/.codex/config.toml");
        expect(text).toContain("[mcp_servers.fragiola]");
        expect(text).toContain('args = ["fragiola@latest", "mcp"]');
    });

    it("keeps the other servers and keys, and is idempotent", async () => {
        await writeFile(
            join(cwd, ".mcp.json"),
            JSON.stringify({
                mcpServers: {
                    shadcn: { command: "npx", args: ["shadcn@latest", "mcp"] },
                },
                other: true,
            }),
        );
        await init("claude");
        const once = await readFile(join(cwd, ".mcp.json"), "utf8");
        await init("claude");
        expect(await readFile(join(cwd, ".mcp.json"), "utf8")).toBe(once);
        expect(JSON.parse(once)).toEqual({
            mcpServers: {
                shadcn: { command: "npx", args: ["shadcn@latest", "mcp"] },
                fragiola: { command: "npx", args: ["fragiola@latest", "mcp"] },
            },
            other: true,
        });
    });

    it("refuses invalid JSON and leaves the file untouched", async () => {
        await writeFile(join(cwd, ".mcp.json"), "{ broken");
        await expect(init("claude")).rejects.toThrow(
            ".mcp.json is not valid JSON",
        );
        expect(await readFile(join(cwd, ".mcp.json"), "utf8")).toBe("{ broken");
    });

    it("asks for the client only when someone can answer", async () => {
        await expect(init()).rejects.toThrow(
            "Choose a client with --client: claude, cursor, vscode, opencode, codex.",
        );
        await init(undefined, {
            interactive: true,
            prompt: async () => "cursor",
        });
        expect(await readJson(".cursor/mcp.json")).toMatchObject({
            mcpServers: { fragiola: {} },
        });
    });

    it("rejects an unknown client", async () => {
        await expect(init("emacs")).rejects.toThrow('Unknown client "emacs"');
    });

    it("lists every documented client", () => {
        expect(CLIENTS.map((client) => client.name)).toEqual([
            "claude",
            "cursor",
            "vscode",
            "opencode",
            "codex",
        ]);
    });
});

describe("the built command", () => {
    it("writes the config in --cwd", async () => {
        execFileSync(
            "node",
            [bin, "mcp", "init", "--client", "claude", "--cwd", cwd],
            { stdio: "pipe" },
        );
        expect(await readJson(".mcp.json")).toMatchObject({
            mcpServers: { fragiola: { command: "npx" } },
        });
    });

    it("fails without --client outside a terminal, and on an unknown client", () => {
        const missing = spawnSync("node", [bin, "mcp", "init", "--cwd", cwd], {
            input: "",
            encoding: "utf8",
        });
        expect(missing.status).toBe(1);
        expect(missing.stderr).toContain("Choose a client with --client");
        const unknown = spawnSync(
            "node",
            [bin, "mcp", "init", "--client", "emacs"],
            { encoding: "utf8" },
        );
        expect(unknown.status).not.toBe(0);
        expect(unknown.stderr).toContain(
            "claude, cursor, vscode, opencode, codex",
        );
    });
});
