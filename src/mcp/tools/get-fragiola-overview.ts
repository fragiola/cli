import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { formatProjects } from "../format.ts";
import { instructions } from "../instructions.ts";
import { tool } from "../tool.ts";

export function registerGetFragiolaOverview(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "get_fragiola_overview",
        {
            title: "Fragiola overview",
            description:
                "Start here. Explains what Fragiola is, its two kinds of components (Fragiola UI source code through the shadcn registry, and headless npm libraries), how each is installed and styled, and lists every project.",
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_fragiola_overview", async () => {
            const index = await catalog.index();
            const overview = await catalog.overview();
            return [
                "# Fragiola for agents",
                "",
                instructions,
                "",
                "---",
                "",
                overview.trim(),
                "",
                "---",
                "",
                "# Projects",
                "",
                formatProjects(index.projects, index.site, index.registry),
            ].join("\n");
        }),
    );
}
