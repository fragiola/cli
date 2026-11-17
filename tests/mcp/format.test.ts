import { describe, expect, it, vi } from "vitest";
import { ContentError } from "../../src/content/errors.ts";
import type { Project } from "../../src/content/schema.ts";
import {
    absolute,
    addCommand,
    formatApiList,
    formatEntries,
    formatError,
    formatInstall,
    formatSearch,
    installCommands,
    libraryInstalls,
    pagePackage,
    paginate,
} from "../../src/mcp/format.ts";

const library: Project = {
    slug: "dockable",
    title: "Dockable",
    description: "Dockable panels.",
    kind: "library",
    packages: [
        { name: "@fragiola/dockable", role: "core" },
        {
            name: "@fragiola/dockable-react",
            role: "adapter",
            framework: "react",
        },
    ],
    frameworks: ["react"],
    keywords: [],
    docs: "/dockable/docs/",
    pages: [
        {
            path: "api/tab",
            title: "Tab",
            section: "API: primitives (@fragiola/dockable-react)",
            api: true,
            url: "/dockable/docs/api/tab/",
            markdown: "/agents/dockable/api/tab.md",
        },
        {
            path: "concepts/model",
            title: "The model",
            section: "Concepts",
            api: false,
            url: "/dockable/docs/concepts/model/",
            markdown: "/agents/dockable/concepts/model.md",
        },
    ],
    examples: [],
    components: [],
};

const ui: Project = {
    ...library,
    slug: "ui",
    title: "Fragiola UI",
    kind: "registry",
    packages: [],
    pages: [],
    components: [
        {
            name: "select",
            type: "registry:ui",
            group: "component",
            description: "A select.",
            docs: null,
            item: "/r/select.json",
        },
    ],
};

describe("helpers", () => {
    it("paginates, with 0 meaning everything", () => {
        expect(paginate([1, 2, 3, 4], { offset: 1, limit: 2 })).toEqual([2, 3]);
        expect(paginate([1, 2, 3], { offset: 0, limit: 0 })).toEqual([1, 2, 3]);
    });

    it("builds commands and URLs", () => {
        expect(addCommand(["@fragiola/a", "@fragiola/b"])).toBe(
            "npx shadcn@latest add @fragiola/a @fragiola/b",
        );
        expect(installCommands(["@fragiola/x", "@fragiola/x-react"])).toEqual([
            "npm install @fragiola/x @fragiola/x-react",
            "pnpm add @fragiola/x @fragiola/x-react",
        ]);
        expect(absolute("https://fragiola.com/", "/ui/docs/")).toBe(
            "https://fragiola.com/ui/docs/",
        );
        expect(absolute("https://fragiola.com", "https://x.test/a")).toBe(
            "https://x.test/a",
        );
    });

    it("names the package an API page documents", () => {
        expect(pagePackage(library, library.pages[0])).toBe(
            "@fragiola/dockable-react",
        );
        expect(pagePackage(library, library.pages[1])).toBe(
            "@fragiola/dockable",
        );
        expect(pagePackage(library, undefined)).toBe("@fragiola/dockable");
    });
});

describe("formatEntries", () => {
    const component = ui.components[0];
    if (!component) throw new Error("fixture");
    const entries = [
        { kind: "registry" as const, project: ui, component },
        { kind: "library" as const, project: library, page: library.pages[0] },
    ];

    it("groups the two kinds and tags every line", () => {
        const text = formatEntries(
            entries,
            { offset: 0, limit: 100 },
            "@fragiola",
        );
        expect(text).toContain("## Fragiola UI: source code");
        expect(text).toContain("## Libraries: npm packages");
        expect(text).toContain(
            "- select (component) - A select. [ui · source code]",
        );
        expect(text).toContain("`npx shadcn@latest add @fragiola/select`");
        expect(text).toContain("[library · @fragiola/dockable-react]");
        expect(text).toContain(
            'get_api { project: "dockable", name: "api/tab" }',
        );
        expect(text).toContain("Showing 1–2 of 2.");
    });

    it("says when more items are available, when the offset is past the end, and when nothing matches", () => {
        expect(
            formatEntries(entries, { offset: 0, limit: 1 }, undefined),
        ).toContain("Use offset: 1");
        expect(
            formatEntries(entries, { offset: 5, limit: 1 }, undefined),
        ).toContain("past the end");
        expect(formatEntries([], { offset: 0, limit: 1 }, undefined)).toBe(
            "No components match these filters.",
        );
    });
});

describe("formatSearch", () => {
    it("says what to call next, and when nothing matches", () => {
        const page = library.pages[1];
        if (!page) throw new Error("fixture");
        const text = formatSearch(
            "model",
            [{ type: "page", project: library, page, score: 1 }],
            { offset: 0, limit: 10 },
            undefined,
        );
        expect(text).toContain("Dockable › Concepts › The model");
        expect(text).toContain(
            'get_docs { project: "dockable", path: "concepts/model" }',
        );
        expect(
            formatSearch("zz", [], { offset: 0, limit: 10 }, undefined),
        ).toContain('No Fragiola components or docs pages match "zz"');
    });
});

describe("formatApiList", () => {
    it("groups API pages by section", () => {
        const text = formatApiList(library);
        expect(text).toContain("## API: primitives (@fragiola/dockable-react)");
        expect(text).toContain("- api/tab: Tab");
    });

    it("points a library without API pages to its concepts, and Fragiola UI to its components", () => {
        expect(
            formatApiList({
                ...library,
                pages: [library.pages[1] as (typeof library.pages)[number]],
            }),
        ).toContain("has no API reference pages yet");
        expect(formatApiList(ui)).toContain("is source code, not a library");
    });
});

describe("formatInstall", () => {
    it("separates the shadcn flow from the npm install", () => {
        const component = ui.components[0];
        if (!component) throw new Error("fixture");
        const text = formatInstall(
            [
                {
                    name: "select",
                    found: [{ type: "component", project: ui, component }],
                },
                {
                    name: "dockable",
                    found: [
                        {
                            type: "library",
                            project: library,
                            packages: library.packages,
                        },
                    ],
                },
                { name: "nope", found: [] },
            ],
            undefined,
        );
        expect(text).toContain("## Fragiola UI (source code)");
        expect(text).toContain('"@fragiola": {');
        expect(text).toContain("npx shadcn@latest add @fragiola/select");
        expect(text).toContain("## Libraries (npm packages)");
        expect(text).toContain(
            "Install the adapter for the project's framework",
        );
        expect(text).toContain(
            "# react\nnpm install @fragiola/dockable-react\n# or: pnpm add @fragiola/dockable-react",
        );
        expect(text).toContain(
            "# no framework (the core alone)\nnpm install @fragiola/dockable\n",
        );
        expect(text).not.toContain(
            "@fragiola/dockable @fragiola/dockable-react",
        );
        expect(text).toContain("Not found: nope.");
    });

    it("names the other kind of a shared name instead of dropping it", () => {
        const component = ui.components[0];
        if (!component) throw new Error("fixture");
        const text = formatInstall(
            [
                {
                    name: "dockable",
                    found: [
                        {
                            type: "library",
                            project: library,
                            packages: library.packages,
                        },
                        { type: "component", project: ui, component },
                    ],
                },
            ],
            undefined,
        );
        expect(text).toContain("npm install @fragiola/dockable-react");
        expect(text).toContain(
            '"dockable" is also a Fragiola UI component (source code)',
        );
    });

    it("keeps one framework, and says when a library has no adapter for it", () => {
        const found = [
            {
                name: "dockable",
                found: [
                    {
                        type: "library" as const,
                        project: library,
                        packages: library.packages,
                    },
                ],
            },
        ];
        const react = formatInstall(found, undefined, "React");
        expect(react).toContain("npm install @fragiola/dockable-react");
        expect(react).not.toContain("the core alone");
        expect(formatInstall(found, undefined, "svelte")).toContain(
            "Dockable has no svelte adapter. Its frameworks: react.",
        );
    });
});

describe("libraryInstalls", () => {
    const core = { name: "@fragiola/x", role: "core" as const };
    const packages = [
        core,
        {
            name: "@fragiola/x-react",
            role: "adapter" as const,
            framework: "react",
        },
        { name: "@fragiola/x-angular", role: "adapter" as const },
    ];

    it("gives each adapter alone, then the core alone", () => {
        expect(libraryInstalls(packages)).toEqual([
            { framework: "react", package: "@fragiola/x-react" },
            { framework: "angular", package: "@fragiola/x-angular" },
            { framework: undefined, package: "@fragiola/x" },
        ]);
    });

    it("narrows to a framework, or to the packages asked for", () => {
        expect(libraryInstalls(packages, "angular")).toEqual([
            { framework: "angular", package: "@fragiola/x-angular" },
        ]);
        expect(libraryInstalls(packages, "vue")).toEqual([]);
        expect(libraryInstalls([core], "react")).toEqual([
            { framework: undefined, package: "@fragiola/x" },
        ]);
        expect(libraryInstalls([core])).toEqual([
            { framework: undefined, package: "@fragiola/x" },
        ]);
    });
});

describe("formatError", () => {
    it("shows the code, the suggestion and FRAGIOLA_URL when it is set", () => {
        vi.stubEnv("FRAGIOLA_URL", "http://localhost:4400");
        const text = formatError(
            new ContentError("NOT_FOUND", "Missing.", {
                suggestion: "Try again.",
            }),
        );
        vi.unstubAllEnvs();
        expect(text).toContain("Error (NOT_FOUND): Missing.");
        expect(text).toContain("Suggestion: Try again.");
        expect(text).toContain("FRAGIOLA_URL is set to http://localhost:4400.");
        expect(formatError(new Error("boom"))).toBe("Error: boom");
    });
});
