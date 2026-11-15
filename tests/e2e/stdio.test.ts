import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client, type ClientOptions } from "@modelcontextprotocol/client";
import {
    getDefaultEnvironment,
    StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toolNames } from "../../src/mcp/index.ts";
import { startServer, type TestServer } from "../helpers/server.ts";

type NegotiationMode = NonNullable<ClientOptions["versionNegotiation"]>["mode"];

const bin = fileURLToPath(new URL("../../dist/cli.mjs", import.meta.url));
let site: TestServer;

beforeAll(async () => {
    site = await startServer();
});

afterAll(() => site.close());

describe("fragiola mcp over stdio", () => {
    it.each<[string, NegotiationMode]>([
        ["2025-11-25", "legacy"],
        ["2026-07-28", { pin: "2026-07-28" }],
    ])("serves protocol %s", async (protocolVersion, mode) => {
        const client = new Client(
            { name: "fragiola-e2e", version: "0.0.0" },
            { versionNegotiation: { mode } },
        );
        await client.connect(
            new StdioClientTransport({
                command: "node",
                args: [bin, "mcp"],
                env: { ...getDefaultEnvironment(), FRAGIOLA_URL: site.url },
            }),
        );
        try {
            expect(client.getNegotiatedProtocolVersion()).toBe(protocolVersion);
            expect(client.getServerVersion()?.name).toBe("fragiola");
            expect(client.getInstructions()).toContain("TWO KINDS");
            const { tools } = await client.listTools();
            expect(tools.map((tool) => tool.name)).toEqual([...toolNames]);

            const result = await client.callTool({
                name: "get_component",
                arguments: { names: ["select"] },
            });
            expect(result.isError).toBeFalsy();
            const [block] = result.content as { type: string; text: string }[];
            expect(block?.text).toContain(
                "## Select (Fragiola UI `select`) [ui · source code]",
            );
        } finally {
            await client.close();
        }
    });

    it("writes nothing to stdout but the protocol", () => {
        // stdin is closed at once: the server starts, writes nothing, and exits.
        const run = spawnSync("node", [bin, "mcp"], {
            input: "",
            encoding: "utf8",
            env: { ...process.env, FRAGIOLA_URL: site.url },
            timeout: 10_000,
        });
        expect(run.stdout).toBe("");
    });
});
