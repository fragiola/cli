import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import {
    groupField,
    kindField,
    limitField,
    offsetField,
    windowOf,
} from "../fields.ts";
import { formatEntries } from "../format.ts";
import { tool } from "../tool.ts";

export function registerListComponents(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "list_components",
        {
            title: "List Fragiola components",
            description:
                "Lists what can be used: Fragiola UI components (source code, each with its shadcn add command) and the libraries' API entries (npm packages). Every line says which kind it is. Filter by kind, project or group; paginate with limit and offset.",
            inputSchema: z.object({
                kind: kindField,
                project: z
                    .string()
                    .optional()
                    .describe('Only this project ("ui", "dockable", …).'),
                group: groupField,
                limit: limitField,
                offset: offsetField,
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("list_components", async (args) => {
            const index = await catalog.index();
            const entries = await catalog.entries({
                kind: args.kind ?? "all",
                ...(args.project ? { project: args.project } : {}),
                ...(args.group ? { group: args.group } : {}),
            });
            return formatEntries(
                entries,
                windowOf(args),
                index.registry?.namespace,
            );
        }),
    );
}
