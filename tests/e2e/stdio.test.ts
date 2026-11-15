import { spawn } from "node:child_process";
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

    it("writes nothing to stdout but the protocol, even when a tool fails", async () => {
        // The site answers 503 to everything, so the tool fails and its error is logged.
        const down = await startServer((_request, response) => {
            response.writeHead(503, "Service Unavailable").end();
            return true;
        });
        const child = spawn("node", [bin, "mcp"], {
            env: { ...process.env, FRAGIOLA_URL: down.url },
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
            stderr += chunk;
        });
        const send = (message: object) =>
            child.stdin.write(`${JSON.stringify(message)}\n`);
        const waitFor = async (id: number) => {
            for (let tries = 0; tries < 200; tries += 1) {
                if (
                    stdout
                        .split("\n")
                        .some((line) => line.includes(`"id":${id}`))
                )
                    return;
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            throw new Error(
                `No response ${id}. stdout: ${stdout} stderr: ${stderr}`,
            );
        };
        try {
            send({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2025-11-25",
                    capabilities: {},
                    clientInfo: { name: "raw", version: "0.0.0" },
                },
            });
            await waitFor(1);
            send({ jsonrpc: "2.0", method: "notifications/initialized" });
            send({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: { name: "list_projects", arguments: {} },
            });
            await waitFor(2);
        } finally {
            child.stdin.end();
            await new Promise((resolve) => child.once("close", resolve));
            await down.close();
        }
        const lines = stdout.split("\n").filter((line) => line.trim() !== "");
        expect(lines.length).toBeGreaterThanOrEqual(2);
        for (const line of lines)
            expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
        expect(stdout).toContain('"isError":true');
        expect(stderr).toContain("list_projects failed");
    });
});
