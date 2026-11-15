import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { instructions, toolNames } from "../../src/mcp/index.ts";
import { type Connected, connect } from "../helpers/mcp.ts";
import { startServer, type TestServer } from "../helpers/server.ts";

let site: TestServer;
let mcp: Connected;

beforeAll(async () => {
    site = await startServer();
    mcp = await connect(site.url);
});

afterAll(async () => {
    await mcp.close();
    await site.close();
});

describe("the server", () => {
    it("registers the eight tools, each with a description and an object input schema", async () => {
        const { tools } = await mcp.client.listTools();
        expect(tools.map((tool) => tool.name)).toEqual([...toolNames]);
        for (const tool of tools) {
            expect(tool.description?.length).toBeGreaterThan(40);
            expect(tool.inputSchema.type).toBe("object");
        }
    });

    it("sends instructions that name both kinds and how each is consumed", () => {
        const sent = mcp.client.getInstructions();
        expect(sent).toBe(instructions);
        expect(sent).toContain("SOURCE CODE");
        expect(sent).toContain("NPM PACKAGES");
        expect(sent).toContain("npx shadcn@latest add @fragiola/<name>");
        expect(sent).toContain("@fragiola/<x>-react");
    });
});

describe("get_fragiola_overview", () => {
    it("returns the instructions, the overview and the projects", async () => {
        const { text, isError } = await mcp.call("get_fragiola_overview");
        expect(isError).toBe(false);
        expect(text).toContain("# Fragiola for agents");
        expect(text).toContain(
            "Fragiola is an ecosystem of components and libraries",
        );
        expect(text).toContain(
            "## Fragiola UI (`ui`): Fragiola UI: source code",
        );
        expect(text).toContain(
            "## Dockable (`dockable`): library: npm packages",
        );
    });
});

describe("list_projects", () => {
    it("lists every project with how to install it", async () => {
        const { text } = await mcp.call("list_projects");
        expect(text).toContain("Fragiola has 3 projects.");
        expect(text).toContain(
            "- Install: `npm install @fragiola/dockable @fragiola/dockable-react`",
        );
        expect(text).toContain(
            "API pages: none; the concepts and guides document it",
        );
    });

    it("filters by kind", async () => {
        const { text } = await mcp.call("list_projects", { kind: "registry" });
        expect(text).toContain("Fragiola has 1 projects.");
        expect(text).not.toContain("Dockable (`dockable`)");
    });
});

describe("list_components", () => {
    it("lists both kinds, tagged", async () => {
        const { text } = await mcp.call("list_components");
        expect(text).toContain("Found 9 Fragiola components.");
        expect(text).toContain("[ui · source code]");
        expect(text).toContain(
            "[library · @fragiola/grid-layout, @fragiola/grid-layout-react]",
        );
    });

    it("filters and paginates", async () => {
        expect(
            (await mcp.call("list_components", { group: "atom" })).text,
        ).toContain("- clickable (atom)");
        const page = await mcp.call("list_components", {
            kind: "registry",
            limit: 2,
            offset: 2,
        });
        expect(page.text).toContain("Showing 3–4 of 6.");
        expect(page.text).toContain("Use offset: 4");
        expect(
            (
                await mcp.call("list_components", {
                    kind: "library",
                    group: "theme",
                })
            ).text,
        ).toBe("No components match these filters.");
    });

    it("reports an unknown project", async () => {
        const { text, isError } = await mcp.call("list_components", {
            project: "scheduler",
        });
        expect(isError).toBe(true);
        expect(text).toContain("Error (NOT_FOUND)");
        expect(text).toContain("ui, dockable, grid-layout");
    });

    it("rejects invalid input", async () => {
        const { isError } = await mcp.call("list_components", {
            kind: "plugin",
        });
        expect(isError).toBe(true);
    });
});

describe("search_fragiola", () => {
    it("finds components and pages", async () => {
        const { text } = await mcp.call("search_fragiola", { query: "select" });
        expect(text).toContain("- select (component)");
        expect(text).toContain('get_component { names: ["select"] }');
        expect(text).toContain("Fragiola UI › Fields › Select");
    });

    it("says when nothing matches", async () => {
        const { text, isError } = await mcp.call("search_fragiola", {
            query: "zzzzqqq",
        });
        expect(isError).toBe(false);
        expect(text).toContain("No Fragiola components or docs pages match");
    });
});

describe("get_component", () => {
    it("describes a Fragiola UI component as source code, with its docs", async () => {
        const { text } = await mcp.call("get_component", {
            names: ["@fragiola/select"],
        });
        expect(text).toContain(
            "## Select (Fragiola UI `select`) [ui · source code]",
        );
        expect(text).toContain("not an npm package");
        expect(text).toContain(
            "- Registry dependencies (added with it): @fragiola/clickable, @fragiola/popup",
        );
        expect(text).toContain("### Documentation");
        expect(text).toContain("Call again with include_code: true");
        expect(text).not.toContain("export function Select");
    });

    it("includes the source with include_code", async () => {
        const { text } = await mcp.call("get_component", {
            names: ["select"],
            include_code: true,
        });
        expect(text).toContain("```tsx\nexport function Select()");
    });

    it("describes a library as npm packages, and shows both kinds for a shared name", async () => {
        const { text } = await mcp.call("get_component", {
            names: ["dockable"],
        });
        expect(text).toContain('"dockable" names 2 things, in both kinds.');
        expect(text).toContain(
            "## Dockable (`dockable`) [library · @fragiola/dockable, @fragiola/dockable-react]",
        );
        expect(text).toContain(
            "## Dockable (Fragiola UI `dockable`) [ui · source code]",
        );
    });

    it("returns a library's API page by <library>/<page>", async () => {
        const { text } = await mcp.call("get_component", {
            names: ["dockable/tab"],
        });
        expect(text).toContain(
            "Source: https://fragiola.com/dockable/docs/api/tab/",
        );
        expect(text).toContain("# Tab");
    });

    it("lists the names it cannot find", async () => {
        const { text, isError } = await mcp.call("get_component", {
            names: ["select", "spaceship"],
        });
        expect(isError).toBe(false);
        expect(text).toContain(
            'No Fragiola component, library or package is named "spaceship"',
        );
    });
});

describe("get_docs", () => {
    it("lists a project's pages by section", async () => {
        const { text } = await mcp.call("get_docs", { project: "dockable" });
        expect(text).toContain("## Concepts");
        expect(text).toContain("- concepts/model: The model");
    });

    it("returns one page as Markdown", async () => {
        const { text } = await mcp.call("get_docs", {
            project: "ui",
            path: "select",
        });
        expect(text).toContain(
            "Source: https://fragiola.com/ui/docs/fields/select/ (Fragiola UI › Fields)",
        );
        expect(text).toContain("# Select");
    });

    it("reports a missing page", async () => {
        const { text, isError } = await mcp.call("get_docs", {
            project: "ui",
            path: "nope",
        });
        expect(isError).toBe(true);
        expect(text).toContain("get_docs with project");
    });
});

describe("get_api", () => {
    it("lists and reads a library's API pages", async () => {
        expect(
            (await mcp.call("get_api", { project: "dockable" })).text,
        ).toContain("Dockable API reference (2 pages).");
        const { text } = await mcp.call("get_api", {
            project: "@fragiola/dockable",
            name: "model",
        });
        expect(text).toContain("[library · @fragiola/dockable]");
        expect(text).toContain("# Model");
    });

    it("points a library without API pages to its concepts", async () => {
        const { text } = await mcp.call("get_api", { project: "grid-layout" });
        expect(text).toContain("has no API reference pages yet");
        expect(text).toContain("concepts/model-api");
    });
});

describe("get_install_command", () => {
    it("separates UI components from libraries", async () => {
        const { text } = await mcp.call("get_install_command", {
            items: ["select", "grid-layout"],
        });
        expect(text).toContain("npx shadcn@latest add @fragiola/select");
        expect(text).toContain(
            "npm install @fragiola/grid-layout @fragiola/grid-layout-react",
        );
    });

    it("rejects an empty list", async () => {
        expect(
            (await mcp.call("get_install_command", { items: [] })).isError,
        ).toBe(true);
    });
});

describe("when the site is down", () => {
    it("returns an error with a suggestion instead of failing", async () => {
        const down = await startServer((_request, response) => {
            response.writeHead(503, "Service Unavailable").end();
            return true;
        });
        const offline = await connect(down.url);
        try {
            const { text, isError } = await offline.call("list_projects");
            expect(isError).toBe(true);
            expect(text).toContain("Error (HTTP)");
            expect(text).toContain("Suggestion:");
        } finally {
            await offline.close();
            await down.close();
        }
    });

    it("asks to upgrade on a newer index version", async () => {
        const newer = await startServer((request, response) => {
            if (request.url !== "/agents/index.json") return false;
            response.writeHead(200).end(JSON.stringify({ version: 2 }));
            return true;
        });
        const client = await connect(newer.url);
        try {
            const { text, isError } = await client.call(
                "get_fragiola_overview",
            );
            expect(isError).toBe(true);
            expect(text).toContain("UNSUPPORTED_VERSION");
            expect(text).toContain("fragiola@latest");
        } finally {
            await client.close();
            await newer.close();
        }
    });
});
