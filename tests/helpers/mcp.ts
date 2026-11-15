import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../../src/mcp/index.ts";

export type Connected = {
    client: Client;
    /** Calls a tool and returns its text and whether it is an error. */
    call(
        name: string,
        args?: Record<string, unknown>,
    ): Promise<{ text: string; isError: boolean }>;
    close(): Promise<void>;
};

/** A client connected in process to a server reading `baseUrl`. */
export async function connect(baseUrl: string): Promise<Connected> {
    const server = createServer({ baseUrl, timeoutMs: 2_000 });
    const client = new Client({ name: "fragiola-tests", version: "0.0.0" });
    const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);
    return {
        client,
        async call(name, args = {}) {
            const result = await client.callTool({ name, arguments: args });
            const content = result.content as { type: string; text?: string }[];
            return {
                text: content.map((block) => block.text ?? "").join("\n"),
                isError: result.isError === true,
            };
        },
        async close() {
            await client.close();
            await server.close();
        },
    };
}
