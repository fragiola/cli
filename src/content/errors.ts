export type ContentErrorCode =
    | "NETWORK"
    | "TIMEOUT"
    | "HTTP"
    | "INVALID_JSON"
    | "INVALID_INDEX"
    | "UNSUPPORTED_VERSION"
    | "NOT_FOUND";

/**
 * Everything that can go wrong while reading fragiola.com. The MCP tools turn
 * it into an `isError` result with the code, the message and the suggestion,
 * so the agent knows what to do next.
 */
export class ContentError extends Error {
    readonly code: ContentErrorCode;
    readonly url: string | undefined;
    readonly suggestion: string | undefined;

    constructor(
        code: ContentErrorCode,
        message: string,
        options: { url?: string; suggestion?: string; cause?: unknown } = {},
    ) {
        super(message, { cause: options.cause });
        this.name = "ContentError";
        this.code = code;
        this.url = options.url;
        this.suggestion = options.suggestion;
    }
}
