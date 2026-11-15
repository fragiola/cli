import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Catalog, Resolved } from "../../content/catalog.ts";
import { ContentError } from "../../content/errors.ts";
import type { AgentIndex } from "../../content/schema.ts";
import {
    formatComponent,
    formatError,
    formatLibrary,
    formatNotFound,
    formatPage,
} from "../format.ts";
import { tool } from "../tool.ts";

export function registerGetComponent(
    server: McpServer,
    catalog: Catalog,
): void {
    async function docsOf(
        slug: string,
        path: string,
    ): Promise<string | undefined> {
        try {
            const { page } = await catalog.page(slug, path);
            return await catalog.markdown(page);
        } catch (error) {
            // A component without a page is fine; any other failure is said.
            if (error instanceof ContentError && error.code === "NOT_FOUND")
                return undefined;
            return `(The docs page could not be read. ${formatError(error)})`;
        }
    }

    async function describe(
        match: Resolved,
        includeCode: boolean,
        index: AgentIndex,
    ): Promise<string> {
        if (match.type === "component") {
            const item = await catalog.registryItem(match.component);
            const docs = match.component.docs
                ? await docsOf(match.project.slug, match.component.docs)
                : undefined;
            return formatComponent({
                project: match.project,
                component: match.component,
                item,
                docs,
                includeCode,
                site: index.site,
                registry: index.registry,
            });
        }
        if (match.type === "library")
            return formatLibrary(match.project, match.packages, index.site);
        return formatPage(
            match.project,
            match.page,
            await catalog.markdown(match.page),
            index.site,
        );
    }

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
                // One failing name never hides the others' results.
                try {
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
                        sections.push(
                            await describe(match, include_code ?? false, index),
                        );
                    }
                } catch (error) {
                    sections.push(`${name}: ${formatError(error)}`);
                }
            }
            if (missing.length > 0) sections.push(formatNotFound(missing));
            return sections.join("\n\n---\n\n");
        }),
    );
}
