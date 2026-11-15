import { z } from "zod";
import { componentGroups } from "../content/schema.ts";
import { DEFAULT_LIMIT, type Window } from "./format.ts";

export const kindField = z
    .enum(["registry", "library", "all"])
    .optional()
    .describe(
        'Which kind to include: "registry" for Fragiola UI (source code copied with the shadcn CLI), "library" for the npm libraries (@fragiola/dockable, …), or "all" (the default).',
    );

export const groupField = z
    .enum(componentGroups)
    .optional()
    .describe(
        "Only Fragiola UI items of this group: component, atom, family (a shared style), lib (helpers), theme or palette.",
    );

export const projectField = z
    .string()
    .describe(
        'A project slug from list_projects ("ui", "dockable", "data-grid", "grid-layout", …) or one of its package names.',
    );

export const limitField = z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
        `Maximum number of items to return (default ${DEFAULT_LIMIT}; 0 for no limit).`,
    );

export const offsetField = z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of items to skip, for pagination (default 0).");

export function windowOf(args: {
    limit?: number | undefined;
    offset?: number | undefined;
}): Window {
    return { limit: args.limit ?? DEFAULT_LIMIT, offset: args.offset ?? 0 };
}
