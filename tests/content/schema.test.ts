import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    agentIndexSchema,
    registryItemSchema,
} from "../../src/content/schema.ts";
import { FIXTURE_SITE } from "../helpers/server.ts";

const read = (path: string): unknown =>
    JSON.parse(readFileSync(join(FIXTURE_SITE, path), "utf8"));

describe("the agent index schema", () => {
    it("parses the fixture index and drops unknown fields", () => {
        const index = agentIndexSchema.parse(read("agents/index.json"));
        expect(
            index.projects.map((project) => [project.slug, project.kind]),
        ).toEqual([
            ["ui", "registry"],
            ["dockable", "library"],
            ["grid-layout", "library"],
        ]);
        expect(index.projects[0]).not.toHaveProperty("futureField");
    });

    it("fills the optional lists with empty arrays", () => {
        const index = agentIndexSchema.parse({
            version: 1,
            site: "https://fragiola.com",
            overview: "/agents/overview.md",
            projects: [
                {
                    slug: "x",
                    title: "X",
                    description: "",
                    kind: "library",
                    docs: "/x/docs/",
                },
            ],
        });
        expect(index.projects[0]).toMatchObject({
            packages: [],
            pages: [],
            examples: [],
            components: [],
        });
    });

    it("rejects an unknown kind and an unknown group", () => {
        const index = read("agents/index.json") as {
            projects: Record<string, unknown>[];
        };
        const badKind = structuredClone(index);
        (badKind.projects[0] as Record<string, unknown>).kind = "plugin";
        expect(agentIndexSchema.safeParse(badKind).success).toBe(false);

        const badGroup = structuredClone(index) as {
            projects: { components: { group: string }[] }[];
        };
        (badGroup.projects[0]?.components[0] as { group: string }).group =
            "block";
        expect(agentIndexSchema.safeParse(badGroup).success).toBe(false);
    });

    it("parses every fixture registry item", () => {
        const item = registryItemSchema.parse(read("r/select.json"));
        expect(item.registryDependencies).toEqual([
            "@fragiola/clickable",
            "@fragiola/popup",
        ]);
        expect(item.files[0]?.content).toContain("export function Select");
    });
});
