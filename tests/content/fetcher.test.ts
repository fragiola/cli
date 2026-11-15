import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentError } from "../../src/content/errors.ts";
import {
    createContentClient,
    DEFAULT_BASE_URL,
    resolveBaseUrl,
} from "../../src/content/fetcher.ts";
import { startServer, type TestServer } from "../helpers/server.ts";

let server: TestServer | undefined;

afterEach(async () => {
    await server?.close();
    server = undefined;
    vi.unstubAllEnvs();
});

async function rejection(promise: Promise<unknown>): Promise<ContentError> {
    const error = await promise.then(
        () => undefined,
        (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ContentError);
    return error as ContentError;
}

describe("the base URL", () => {
    it("defaults to fragiola.com", () => {
        vi.stubEnv("FRAGIOLA_URL", undefined);
        expect(resolveBaseUrl()).toBe(DEFAULT_BASE_URL);
        expect(DEFAULT_BASE_URL).toBe("https://fragiola.com");
    });

    it("is overridden by FRAGIOLA_URL, then by the option", () => {
        vi.stubEnv("FRAGIOLA_URL", "http://localhost:4400/");
        expect(resolveBaseUrl()).toBe("http://localhost:4400");
        expect(resolveBaseUrl("http://example.test//")).toBe(
            "http://example.test",
        );
    });

    it("joins site paths to the base", () => {
        const client = createContentClient({ baseUrl: "http://example.test" });
        expect(client.url("/agents/index.json")).toBe(
            "http://example.test/agents/index.json",
        );
        expect(client.url("r/select.json")).toBe(
            "http://example.test/r/select.json",
        );
        expect(client.url("https://other.test/x")).toBe("https://other.test/x");
    });
});

describe("the content client", () => {
    it("reads the index and caches every response for the session", async () => {
        server = await startServer();
        const client = createContentClient({ baseUrl: server.url });
        const index = await client.index();
        await client.index();
        expect(index.projects).toHaveLength(3);
        expect(
            server.requests.filter((path) => path === "/agents/index.json"),
        ).toHaveLength(1);

        client.clear();
        await client.index();
        expect(
            server.requests.filter((path) => path === "/agents/index.json"),
        ).toHaveLength(2);
    });

    it("reads Markdown and registry items", async () => {
        server = await startServer();
        const client = createContentClient({ baseUrl: server.url });
        expect(await client.text("/agents/overview.md")).toContain(
            "# Fragiola",
        );
        expect((await client.registryItem("/r/select.json")).name).toBe(
            "select",
        );
    });

    it("says when the site does not serve the agent index", async () => {
        server = await startServer((request, response) => {
            if (request.url !== "/agents/index.json") return false;
            response.writeHead(404).end();
            return true;
        });
        const error = await rejection(
            createContentClient({ baseUrl: server.url }).index(),
        );
        expect(error.code).toBe("NOT_FOUND");
        expect(error.message).toContain("agent index");
        expect(error.suggestion).toBeTruthy();
    });

    it("rejects a newer major version with an upgrade hint", async () => {
        server = await startServer((request, response) => {
            if (request.url !== "/agents/index.json") return false;
            response
                .writeHead(200)
                .end(JSON.stringify({ version: 2, projects: [] }));
            return true;
        });
        const error = await rejection(
            createContentClient({ baseUrl: server.url }).index(),
        );
        expect(error.code).toBe("UNSUPPORTED_VERSION");
        expect(error.suggestion).toContain("fragiola@latest");
    });

    it("reports invalid JSON and an index of the wrong shape", async () => {
        server = await startServer((request, response) => {
            if (request.url === "/agents/index.json") {
                response
                    .writeHead(200)
                    .end(JSON.stringify({ version: 1, projects: "nope" }));
                return true;
            }
            if (request.url === "/r/broken.json") {
                response.writeHead(200).end("{ not json");
                return true;
            }
            return false;
        });
        const client = createContentClient({ baseUrl: server.url });
        expect((await rejection(client.index())).code).toBe("INVALID_INDEX");
        expect(
            (await rejection(client.registryItem("/r/broken.json"))).code,
        ).toBe("INVALID_JSON");
    });

    it("reports HTTP errors and does not cache failures", async () => {
        let calls = 0;
        server = await startServer((request, response) => {
            if (request.url !== "/agents/overview.md") return false;
            calls += 1;
            if (calls === 1) {
                response.writeHead(503, "Service Unavailable").end();
                return true;
            }
            return false;
        });
        const client = createContentClient({ baseUrl: server.url });
        const error = await rejection(client.text("/agents/overview.md"));
        expect(error.code).toBe("HTTP");
        expect(error.message).toContain("503");
        expect(await client.text("/agents/overview.md")).toContain("Fragiola");
    });

    it("reports an unreachable site and a timeout", async () => {
        const offline = createContentClient({
            baseUrl: "http://example.test",
            fetch: () => Promise.reject(new TypeError("fetch failed")),
        });
        expect((await rejection(offline.index())).code).toBe("NETWORK");

        server = await startServer(() => new Promise<boolean>(() => {}));
        const slow = createContentClient({
            baseUrl: server.url,
            timeoutMs: 50,
        });
        expect((await rejection(slow.text("/agents/overview.md"))).code).toBe(
            "TIMEOUT",
        );
    });
});
