import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog } from "../../content/catalog.ts";
import {
    formatComponent,
    formatLibrary,
    formatNotFound,
    formatPage,
} from "../format.ts";
import { tool } from "../tool.ts";

export function registerGetComponent(
    server: McpServer,
    catalog: Catalog,
): void {
    server.registerTool(
        "get_component",
        {
            title: "Get Fragiola components",
            description:
                'Details of one or more components or libraries by name. A Fragiola UI component ("select", "@fragiola/select") returns its add command, dependencies, files and docs; include_code adds its source. A library ("dockable", "@fragiola/dockable-react") returns its packages, install command and API index. "<library>/<page>" ("dockable/tab") returns that API page. A name that is both shows both.',
            inputSchema: z.object({
                names: z
                    .array(z.string().min(1))
                    .min(1)
                    .describe(
                        'Names to look up, e.g. ["select", "@fragiola/sidebar", "dockable", "dockable/tab"].',
                    ),
                include_code: z
                    .boolean()
                    .optional()
                    .describe(
                        "For Fragiola UI components, include the full source of their files (default false).",
                    ),
            }),
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        tool("get_component", async ({ names, include_code }) => {
            const index = await catalog.index();
            const sections: string[] = [];
            const missing: string[] = [];
            for (const name of names) {
                const found = await catalog.resolve(name);
                if (found.length === 0) {
                    missing.push(name);
                    continue;
                }
                if (found.length > 1) {
                    sections.push(
                        `"${name}" names ${found.length} things, in both kinds. Each is shown below: use the one the task needs.`,
                    );
                }
                for (const match of found) {
                    if (match.type === "component") {
                        const item = await catalog.registryItem(
                            match.component,
                        );
                        const docs = match.component.docs
                            ? await catalog
                                  .page(
                                      match.project.slug,
                                      match.component.docs,
                                  )
                                  .then(({ page }) => catalog.markdown(page))
                                  .catch(() => undefined)
                            : undefined;
                        sections.push(
                            formatComponent({
                                project: match.project,
                                component: match.component,
                                item,
                                docs,
                                includeCode: include_code ?? false,
                                site: index.site,
                                registry: index.registry,
                            }),
                        );
                    } else if (match.type === "library") {
                        sections.push(
                            formatLibrary(
                                match.project,
                                match.packages,
                                index.site,
                            ),
                        );
                    } else {
                        const markdown = await catalog.markdown(match.page);
                        sections.push(
                            formatPage(
                                match.project,
                                match.page,
                                markdown,
                                index.site,
                            ),
                        );
                    }
                }
            }
            if (missing.length > 0) sections.push(formatNotFound(missing));
            return sections.join("\n\n---\n\n");
        }),
    );
}
