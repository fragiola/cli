import { McpServer } from "@modelcontextprotocol/server";
import { type Catalog, createCatalog } from "../content/catalog.ts";
import {
    type ContentClientOptions,
    createContentClient,
} from "../content/fetcher.ts";
import { pkg } from "../lib/package.ts";
import { instructions } from "./instructions.ts";
import { registerGetApi } from "./tools/get-api.ts";
import { registerGetComponent } from "./tools/get-component.ts";
import { registerGetDocs } from "./tools/get-docs.ts";
import { registerGetFragiolaOverview } from "./tools/get-fragiola-overview.ts";
import { registerGetInstallCommand } from "./tools/get-install-command.ts";
import { registerListComponents } from "./tools/list-components.ts";
import { registerListProjects } from "./tools/list-projects.ts";
import { registerSearchFragiola } from "./tools/search-fragiola.ts";

export { instructions } from "./instructions.ts";

export type CreateServerOptions = ContentClientOptions & {
    /** A catalog to read from instead of fragiola.com (tests, embedding). */
    catalog?: Catalog;
};

/** The names of every tool the server registers. */
export const toolNames = [
    "get_fragiola_overview",
    "list_projects",
    "list_components",
    "search_fragiola",
    "get_component",
    "get_docs",
    "get_api",
    "get_install_command",
] as const;

/**
 * The Fragiola MCP server, with every tool registered. Each connection gets its
 * own instance (and its own cache of fragiola.com responses).
 */
export function createServer(options: CreateServerOptions = {}): McpServer {
    const { catalog: given, ...client } = options;
    const catalog = given ?? createCatalog(createContentClient(client));
    const server = new McpServer(
        { name: "fragiola", version: pkg.version },
        {
            // The tool set is fixed: declare it before registerTool defaults listChanged to true.
            capabilities: { tools: { listChanged: false }, logging: {} },
            instructions,
        },
    );
    registerGetFragiolaOverview(server, catalog);
    registerListProjects(server, catalog);
    registerListComponents(server, catalog);
    registerSearchFragiola(server, catalog);
    registerGetComponent(server, catalog);
    registerGetDocs(server, catalog);
    registerGetApi(server, catalog);
    registerGetInstallCommand(server, catalog);
    return server;
}
