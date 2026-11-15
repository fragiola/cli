import { z } from "zod";

/**
 * The agent index fragiola.com emits, version 1. `docs/agent-index.md` is the
 * contract; this file matches it field for field. Unknown fields are accepted
 * and dropped, so fragiola.com can add fields without breaking older CLIs.
 */
export const AGENT_INDEX_VERSION = 1;

/** Where the index lives, relative to the base URL. */
export const AGENT_INDEX_PATH = "/agents/index.json";

export const projectKinds = ["registry", "library"] as const;
export type ProjectKind = (typeof projectKinds)[number];

export const componentGroups = [
    "component",
    "atom",
    "family",
    "lib",
    "theme",
    "palette",
] as const;
export type ComponentGroup = (typeof componentGroups)[number];

export const packageSchema = z.object({
    name: z.string().min(1),
    role: z.enum(["core", "adapter"]),
    framework: z.string().optional(),
});

export const pageSchema = z.object({
    path: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    section: z.string(),
    api: z.boolean(),
    url: z.string().min(1),
    markdown: z.string().min(1),
});

export const exampleSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    level: z.string().optional(),
    url: z.string().min(1),
});

export const componentSchema = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    group: z.enum(componentGroups),
    title: z.string().optional(),
    description: z.string().optional(),
    docs: z.string().nullable(),
    item: z.string().min(1),
});

export const projectSchema = z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    kind: z.enum(projectKinds),
    packages: z.array(packageSchema).default([]),
    frameworks: z.array(z.string()).default([]),
    repository: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    docs: z.string().min(1),
    pages: z.array(pageSchema).default([]),
    examples: z.array(exampleSchema).default([]),
    components: z.array(componentSchema).default([]),
});

export const registrySchema = z.object({
    namespace: z.string().min(1),
    index: z.string().min(1),
    item: z.string().includes("{name}"),
    componentsJson: z.record(z.string(), z.object({ url: z.string().min(1) })),
});

export const agentIndexSchema = z.object({
    version: z.literal(AGENT_INDEX_VERSION),
    site: z.string().min(1),
    overview: z.string().min(1),
    registry: registrySchema.optional(),
    projects: z.array(projectSchema),
});

/** A shadcn registry item (`/r/<name>.json`): the fields the tools read. */
export const registryItemSchema = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
    devDependencies: z.array(z.string()).default([]),
    registryDependencies: z.array(z.string()).default([]),
    files: z
        .array(
            z.object({
                path: z.string().min(1),
                type: z.string().optional(),
                target: z.string().optional(),
                content: z.string().optional(),
            }),
        )
        .default([]),
    docs: z.string().optional(),
});

export type Package = z.infer<typeof packageSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Example = z.infer<typeof exampleSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Registry = z.infer<typeof registrySchema>;
export type AgentIndex = z.infer<typeof agentIndexSchema>;
export type RegistryItem = z.infer<typeof registryItemSchema>;
