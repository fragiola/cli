import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Catalog, createCatalog } from "../../src/content/catalog.ts";
import { ContentError } from "../../src/content/errors.ts";
import { createContentClient } from "../../src/content/fetcher.ts";
import { startServer, type TestServer } from "../helpers/server.ts";

let server: TestServer;
let catalog: Catalog;

beforeAll(async () => {
    server = await startServer();
    catalog = createCatalog(createContentClient({ baseUrl: server.url }));
});

afterAll(() => server.close());

describe("projects", () => {
    it("lists every project, or one kind", async () => {
        expect(
            (await catalog.projects()).map((project) => project.slug),
        ).toEqual(["ui", "dockable", "grid-layout"]);
        expect(
            (await catalog.projects("registry")).map((project) => project.slug),
        ).toEqual(["ui"]);
        expect(
            (await catalog.projects("library")).map((project) => project.slug),
        ).toEqual(["dockable", "grid-layout"]);
    });

    it("finds a project by slug or package, and lists the others when it cannot", async () => {
        expect((await catalog.project("dockable")).slug).toBe("dockable");
        expect(
            (await catalog.project("@fragiola/grid-layout-react")).slug,
        ).toBe("grid-layout");
        const error = await catalog
            .project("scheduler")
            .catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(ContentError);
        expect((error as ContentError).suggestion).toContain(
            "ui, dockable, grid-layout",
        );
    });
});

describe("entries", () => {
    it("keeps the two kinds apart", async () => {
        const entries = await catalog.entries();
        const ui = entries.filter((entry) => entry.kind === "registry");
        const libraries = entries.filter((entry) => entry.kind === "library");
        expect(ui).toHaveLength(6);
        // dockable: its two API pages; grid-layout has none, so it is listed once, as its package.
        expect(
            libraries.map((entry) => [entry.project.slug, entry.page?.path]),
        ).toEqual([
            ["dockable", "api/tab"],
            ["dockable", "api/model"],
            ["grid-layout", undefined],
        ]);
    });

    it("filters by kind, project and group", async () => {
        expect(
            await catalog.entries({ kind: "library", group: "atom" }),
        ).toEqual([]);
        const atoms = await catalog.entries({ group: "atom" });
        expect(
            atoms.map(
                (entry) => entry.kind === "registry" && entry.component.name,
            ),
        ).toEqual(["clickable"]);
        expect(await catalog.entries({ project: "grid-layout" })).toHaveLength(
            1,
        );
        expect(
            await catalog.entries({ kind: "registry", project: "dockable" }),
        ).toEqual([]);
    });
});

describe("pages", () => {
    it("finds a page by path, with or without docs/, or by its last segment", async () => {
        expect((await catalog.page("dockable", "api/tab")).page.title).toBe(
            "Tab",
        );
        expect(
            (await catalog.page("dockable", "docs/api/tab/")).page.title,
        ).toBe("Tab");
        expect((await catalog.page("ui", "select")).page.path).toBe(
            "fields/select",
        );
    });

    it("reads a page's Markdown and the overview", async () => {
        const { page } = await catalog.page("dockable", "api/model");
        expect(await catalog.markdown(page)).toContain("# Model");
        expect(await catalog.overview()).toContain("Fragiola UI");
    });

    it("refuses an ambiguous last segment, and never guesses a page from a wrong path", async () => {
        const ambiguous = (await catalog
            .page("dockable", "model")
            .catch((reason: unknown) => reason)) as ContentError;
        expect(ambiguous.code).toBe("AMBIGUOUS");
        expect(ambiguous.message).toContain("concepts/model, api/model");
        const wrong = (await catalog
            .page("dockable", "nonexistent/tab")
            .catch((reason: unknown) => reason)) as ContentError;
        expect(wrong.code).toBe("NOT_FOUND");
    });

    it("prefers API pages for a library's API lookups", async () => {
        expect((await catalog.apiPage("dockable", "model")).page.path).toBe(
            "api/model",
        );
        expect(
            (await catalog.apiPage("dockable", "concepts/model")).page.path,
        ).toBe("concepts/model");
    });

    it("points to the page list when a page does not exist", async () => {
        const error = (await catalog
            .page("dockable", "api/nope")
            .catch((reason: unknown) => reason)) as ContentError;
        expect(error.code).toBe("NOT_FOUND");
        expect(error.suggestion).toContain("get_docs");
    });
});

describe("resolve", () => {
    const types = async (name: string) =>
        (await catalog.resolve(name)).map((found) =>
            found.type === "component"
                ? `component:${found.component.name}`
                : found.type === "library"
                  ? `library:${found.project.slug}:${found.packages.map((pkg) => pkg.name).join("+")}`
                  : `page:${found.project.slug}/${found.page.path}`,
        );

    it("resolves Fragiola UI components with or without the namespace", async () => {
        expect(await types("select")).toEqual(["component:select"]);
        expect(await types("@fragiola/select")).toEqual(["component:select"]);
        expect(await types("ui/select")).toEqual(["component:select"]);
    });

    it("resolves libraries by slug and by package", async () => {
        expect(await types("grid-layout")).toEqual([
            "library:grid-layout:@fragiola/grid-layout+@fragiola/grid-layout-react",
        ]);
        expect(await types("@fragiola/dockable-react")).toEqual([
            "library:dockable:@fragiola/dockable-react",
        ]);
    });

    it("returns both kinds when a name means both", async () => {
        expect(await types("dockable")).toEqual([
            "library:dockable:@fragiola/dockable+@fragiola/dockable-react",
            "component:dockable",
        ]);
    });

    it("resolves a library's API page", async () => {
        expect(await types("dockable/tab")).toEqual(["page:dockable/api/tab"]);
        expect(await types("dockable/api/model")).toEqual([
            "page:dockable/api/model",
        ]);
    });

    it("returns nothing for an unknown name", async () => {
        expect(await catalog.resolve("spaceship")).toEqual([]);
    });
});

describe("search", () => {
    it("finds components and pages", async () => {
        const hits = await catalog.search("select");
        expect(hits[0]).toMatchObject({ type: "component" });
        expect(
            hits.some(
                (hit) =>
                    hit.type === "page" && hit.page.path === "fields/select",
            ),
        ).toBe(true);
    });

    it("filters by kind and limits", async () => {
        const hits = await catalog.search("model", "library");
        expect(hits.length).toBeGreaterThan(0);
        expect(
            hits.every(
                (hit) => hit.type === "page" && hit.project.kind === "library",
            ),
        ).toBe(true);
        expect(await catalog.search("model", "all", 1)).toHaveLength(1);
        expect(await catalog.search("zzzzqqq")).toEqual([]);
    });
});
