import { ContentError } from "./errors.ts";
import {
    AGENT_INDEX_PATH,
    AGENT_INDEX_VERSION,
    type AgentIndex,
    agentIndexSchema,
    type RegistryItem,
    registryItemSchema,
} from "./schema.ts";

export const DEFAULT_BASE_URL = "https://fragiola.com";

export type ContentClientOptions = {
    /** The site to read. Defaults to `FRAGIOLA_URL`, then https://fragiola.com. */
    baseUrl?: string;
    /** Milliseconds before a request is abandoned. */
    timeoutMs?: number;
    fetch?: typeof globalThis.fetch;
};

export type ContentClient = {
    readonly baseUrl: string;
    /** The absolute URL of a site path (`/agents/index.json`, `/ui/docs/…`). */
    url(path: string): string;
    index(): Promise<AgentIndex>;
    text(path: string): Promise<string>;
    registryItem(path: string): Promise<RegistryItem>;
    /** Forgets every cached response. */
    clear(): void;
};

/** The base URL in effect: the option, then `FRAGIOLA_URL`, then fragiola.com. */
export function resolveBaseUrl(baseUrl?: string): string {
    const value = baseUrl ?? process.env.FRAGIOLA_URL ?? DEFAULT_BASE_URL;
    return value.trim().replace(/\/+$/, "");
}

/**
 * Reads fragiola.com's agent index and the files it points to. Responses are
 * cached per URL for the life of the client (one MCP server session), so a
 * conversation pays for each file once.
 */
export function createContentClient(
    options: ContentClientOptions = {},
): ContentClient {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    const timeoutMs = options.timeoutMs ?? 15_000;
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const cache = new Map<string, Promise<string>>();

    function url(path: string): string {
        if (/^https?:\/\//.test(path)) return path;
        return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    }

    function networkError(target: string, cause: unknown): ContentError {
        const timedOut =
            cause instanceof DOMException && cause.name === "TimeoutError";
        return new ContentError(
            timedOut ? "TIMEOUT" : "NETWORK",
            timedOut
                ? `No answer from ${target} after ${timeoutMs} ms.`
                : `Could not reach ${target}.`,
            {
                url: target,
                cause,
                suggestion: `Check the network connection. The base URL is ${baseUrl}${
                    process.env.FRAGIOLA_URL ? " (from FRAGIOLA_URL)" : ""
                }.`,
            },
        );
    }

    async function load(target: string): Promise<string> {
        let response: Response;
        try {
            response = await fetchImpl(target, {
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (cause) {
            throw networkError(target, cause);
        }
        if (!response.ok) {
            throw new ContentError(
                response.status === 404 ? "NOT_FOUND" : "HTTP",
                `${target} answered ${response.status} ${response.statusText}.`.replace(
                    " .",
                    ".",
                ),
                {
                    url: target,
                    suggestion:
                        response.status === 404
                            ? "The file does not exist on the site. List what exists first (list_projects, list_components, get_docs)."
                            : "fragiola.com may be temporarily unavailable. Try again shortly.",
                },
            );
        }
        // The timeout still applies while the body downloads, and a connection can drop mid-body.
        try {
            return await response.text();
        } catch (cause) {
            throw networkError(target, cause);
        }
    }

    function text(path: string): Promise<string> {
        const target = url(path);
        let pending = cache.get(target);
        if (!pending) {
            pending = load(target);
            // A failed request is not cached: the next call tries again.
            const current = pending;
            current.catch(() => {
                // Only this request's entry: a newer one (after clear()) stays.
                if (cache.get(target) === current) cache.delete(target);
            });
            cache.set(target, pending);
        }
        return pending;
    }

    async function json(path: string): Promise<unknown> {
        const body = await text(path);
        try {
            return JSON.parse(body);
        } catch (cause) {
            throw new ContentError(
                "INVALID_JSON",
                `${url(path)} is not valid JSON.`,
                {
                    url: url(path),
                    cause,
                    suggestion:
                        "fragiola.com served a broken file. Try again shortly; if it persists, report it at https://github.com/fragiola/www/issues.",
                },
            );
        }
    }

    async function index(): Promise<AgentIndex> {
        const target = url(AGENT_INDEX_PATH);
        const raw = await json(AGENT_INDEX_PATH).catch((error: unknown) => {
            if (error instanceof ContentError && error.code === "NOT_FOUND") {
                throw new ContentError(
                    "NOT_FOUND",
                    `${baseUrl} does not serve the Fragiola agent index (${AGENT_INDEX_PATH}).`,
                    {
                        url: target,
                        suggestion: process.env.FRAGIOLA_URL
                            ? "FRAGIOLA_URL points at a site without the agent index. Unset it to use https://fragiola.com."
                            : "The agent index is not published yet. Try again later, or set FRAGIOLA_URL to a site that serves it.",
                    },
                );
            }
            throw error;
        });

        const version =
            raw && typeof raw === "object" && "version" in raw
                ? raw.version
                : undefined;
        if (typeof version === "number" && version > AGENT_INDEX_VERSION) {
            throw new ContentError(
                "UNSUPPORTED_VERSION",
                `The agent index is version ${version}; this fragiola CLI reads version ${AGENT_INDEX_VERSION}.`,
                {
                    url: target,
                    suggestion:
                        "Upgrade fragiola: use `npx fragiola@latest mcp` in the MCP client's configuration.",
                },
            );
        }

        const parsed = agentIndexSchema.safeParse(raw);
        if (!parsed.success) {
            throw new ContentError(
                "INVALID_INDEX",
                `The agent index at ${target} does not match the expected format: ${parsed.error.issues
                    .slice(0, 3)
                    .map(
                        (issue) =>
                            `${issue.path.join(".") || "(root)"}: ${issue.message}`,
                    )
                    .join("; ")}.`,
                {
                    url: target,
                    suggestion:
                        "Upgrade fragiola (`npx fragiola@latest mcp`) or report it at https://github.com/fragiola/cli/issues.",
                },
            );
        }
        return parsed.data;
    }

    async function registryItem(path: string): Promise<RegistryItem> {
        const parsed = registryItemSchema.safeParse(await json(path));
        if (!parsed.success) {
            throw new ContentError(
                "INVALID_INDEX",
                `${url(path)} is not a registry item.`,
                {
                    url: url(path),
                    suggestion:
                        "Upgrade fragiola (`npx fragiola@latest mcp`) or report it at https://github.com/fragiola/www/issues.",
                },
            );
        }
        return parsed.data;
    }

    return {
        baseUrl,
        url,
        index,
        text,
        registryItem,
        clear: () => cache.clear(),
    };
}
