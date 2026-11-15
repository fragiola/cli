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
                "The exact commands to add Fragiola UI components (the components.json registry entry plus `npx shadcn@latest add @fragiola/…`) and to install Fragiola libraries (`npm install @fragiola/<x> @fragiola/<x>-react`). Mixed names give both, separated.",
            inputSchema: z.object({
                items: z
                    .array(z.string().min(1))
                    .min(1)
                    .describe(
                        'Component, library or package names, e.g. ["select", "sidebar", "dockable"].',
                    ),
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_install_command", async ({ items }) => {
            const index = await catalog.index();
            const resolved = await Promise.all(
                items.map(async (name) => ({
                    name,
                    found: await catalog.resolve(name),
                })),
            );
            return formatInstall(resolved, index.registry);
        }),
    );
}
