import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { kindField, limitField, offsetField, windowOf } from "../fields.ts";
import { formatSearch } from "../format.ts";
import { tool } from "../tool.ts";

export function registerSearchFragiola(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "search_fragiola",
        {
            title: "Search Fragiola",
            description:
                'Fuzzy search over Fragiola UI components and every docs page (concepts, guides, API) of every project. Use it to find the right component or page for a need ("select", "drag and drop", "theming"). Results say the kind and the tool to call next.',
            inputSchema: z.object({
                query: z
                    .string()
                    .min(1)
                    .describe(
                        "What to look for: a component name, a feature or a topic.",
                    ),
                kind: kindField,
                limit: limitField,
                offset: offsetField,
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("search_fragiola", async (args) => {
            const index = await catalog.index();
            const hits = await catalog.search(args.query, args.kind ?? "all");
            return formatSearch(
                args.query,
                hits,
                windowOf(args),
                index.registry?.namespace,
            );
        }),
    );
}
