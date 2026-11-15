import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { kindField } from "../fields.ts";
import { formatProjects } from "../format.ts";
import { tool } from "../tool.ts";

export function registerListProjects(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "list_projects",
        {
            title: "List Fragiola projects",
            description:
                "Lists the Fragiola projects: Fragiola UI (kind registry, source code) and the libraries (kind library, npm packages), with their packages, frameworks, docs and how each is installed.",
            inputSchema: z.object({ kind: kindField }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("list_projects", async ({ kind }) => {
            const index = await catalog.index();
            return formatProjects(
                await catalog.projects(kind ?? "all"),
                index.site,
                index.registry,
            );
        }),
    );
}
