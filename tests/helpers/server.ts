import { readFile } from "node:fs/promises";
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_SITE = fileURLToPath(
    new URL("../fixtures/site/", import.meta.url),
);

export type TestServer = {
    url: string;
    /** Paths requested so far, in order. */
    requests: string[];
    close(): Promise<void>;
};

type Handler = (
    request: IncomingMessage,
    response: ServerResponse,
) => boolean | Promise<boolean>;

/**
 * A static server for `tests/fixtures/site/` on a random local port. `override`
 * answers a request first (return `true` when it did), for error cases.
 */
export async function startServer(override?: Handler): Promise<TestServer> {
    const requests: string[] = [];
    const server = createServer(async (request, response) => {
        const path = decodeURIComponent(
            new URL(request.url ?? "/", "http://localhost").pathname,
        );
        requests.push(path);
        if (override && (await override(request, response))) return;
        const file = normalize(join(FIXTURE_SITE, path));
        if (!file.startsWith(FIXTURE_SITE)) {
            response.writeHead(403).end();
            return;
        }
        try {
            const body = await readFile(file);
            const type = file.endsWith(".json")
                ? "application/json"
                : "text/markdown; charset=utf-8";
            response.writeHead(200, { "content-type": type }).end(body);
        } catch {
            response.writeHead(404, "Not Found").end("not found");
        }
    });
    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.closeAllConnections();
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}
