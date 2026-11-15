import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { projectField } from "../fields.ts";
import { formatApiList, formatPage } from "../format.ts";
import { tool } from "../tool.ts";

export function registerGetApi(server: McpServer, catalog: Catalog): void {
    server.registerTool(
        "get_api",
        {
            title: "Read a library's API",
            description:
                "The API reference of a Fragiola library (npm packages): without name, its API pages grouped by package (React primitives, core model, commands); with name, that page as Markdown (props, state, attributes). Libraries without API pages point to their concept pages.",
            inputSchema: z.object({
                project: projectField,
                name: z
                    .string()
                    .optional()
                    .describe(
                        'An API page path or its last segment ("api/tab", "tab", "model").',
                    ),
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_api", async ({ project, name }) => {
            const index = await catalog.index();
            const owner = await catalog.project(project);
            if (!name) return formatApiList(owner);
            const found = await catalog.apiPage(owner.slug, name);
            return formatPage(
                found.project,
                found.page,
                await catalog.markdown(found.page),
                index.site,
            );
        }),
    );
}
