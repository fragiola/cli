import type { CallToolResult } from "@modelcontextprotocol/server";
import { log } from "../lib/log.ts";
import { formatError } from "./format.ts";

export function textResult(text: string): CallToolResult {
    return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): CallToolResult {
    return { content: [{ type: "text", text }], isError: true };
}

/**
 * Runs a tool and turns any thrown error into an `isError` result the agent
 * can act on (the code, the message and the suggestion).
 */
export function tool<Args>(
    name: string,
    callback: (args: Args) => Promise<string>,
): (args: Args) => Promise<CallToolResult> {
    return async (args) => {
        try {
            return textResult(await callback(args));
        } catch (error) {
            log.error(
                `[fragiola mcp] ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return errorResult(formatError(error));
        }
    };
}
