import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { projectField } from "../fields.ts";
import { formatPage, formatPageList } from "../format.ts";
import { tool } from "../tool.ts";

export function registerGetDocs(server: McpServer, catalog: Catalog): void {
    server.registerTool(
        "get_docs",
        {
            title: "Read Fragiola docs",
            description:
                "Without path: the docs pages of a project, grouped by section (getting started, concepts, guides, API, …). With path: that page as Markdown, with its fragiola.com URL. Covers Fragiola UI (architecture, palettes, every component) and every library (concepts, layouts, guides).",
            inputSchema: z.object({
                project: projectField,
                path: z
                    .string()
                    .optional()
                    .describe(
                        'A page path from the list ("concepts/model", "fields/select"); its last segment is enough when it is unique.',
                    ),
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_docs", async ({ project, path }) => {
            const index = await catalog.index();
            if (!path)
                return formatPageList(
                    await catalog.project(project),
                    index.site,
                );
            const found = await catalog.page(project, path);
            return formatPage(
                found.project,
                found.page,
                await catalog.markdown(found.page),
                index.site,
            );
        }),
    );
}
