import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import { formatInstall } from "../format.ts";
import { tool } from "../tool.ts";

export function registerGetInstallCommand(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "get_install_command",
        {
            title: "Get install commands",
            description:
                "The exact commands to add Fragiola UI components (the components.json registry entry plus `npx shadcn@latest add @fragiola/…`) and to install Fragiola libraries: one line per framework, each the adapter alone (`npm install @fragiola/<x>-react`), which brings the core. Pass framework to get only that one. Mixed names give both, separated.",
            inputSchema: z.object({
                items: z
                    .array(z.string().min(1))
                    .min(1)
                    .describe(
                        'Component, library or package names, e.g. ["select", "sidebar", "dockable"].',
                    ),
                framework: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        'The project\'s framework, e.g. "react", "vue" or "angular": libraries then give only that adapter.',
                    ),
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_install_command", async ({ items, framework }) => {
            const index = await catalog.index();
            const resolved = await Promise.all(
                items.map(async (name) => ({
                    name,
                    found: await catalog.resolve(name),
                })),
            );
            return formatInstall(resolved, index.registry, framework);
        }),
    );
}
