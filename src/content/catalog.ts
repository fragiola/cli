import fuzzysort from "fuzzysort";
import { ContentError } from "./errors.ts";
import type { ContentClient } from "./fetcher.ts";
import type {
    AgentIndex,
    Component,
    ComponentGroup,
    Package,
    Page,
    Project,
    ProjectKind,
    RegistryItem,
} from "./schema.ts";

/** One thing an agent can use: a Fragiola UI component, or a library entry. */
export type CatalogEntry =
    | { kind: "registry"; project: Project; component: Component }
    | { kind: "library"; project: Project; page: Page | undefined };

export type SearchHit =
    | {
          type: "component";
          entry: CatalogEntry & { kind: "registry" };
          score: number;
      }
    | { type: "page"; project: Project; page: Page; score: number };

/** What a name given by an agent refers to. */
export type Resolved =
    | { type: "component"; project: Project; component: Component }
    | { type: "library"; project: Project; packages: Package[] }
    | { type: "api-page"; project: Project; page: Page };

export type KindFilter = ProjectKind | "all";

const NAMESPACE_PREFIX = /^@fragiola\//;

/** Lowercase, without the `@fragiola/` namespace and surrounding slashes. */
function normalize(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(NAMESPACE_PREFIX, "")
        .replace(/^\/+|\/+$/g, "");
}

/** The last segment of a page path: `api/tab` → `tab`. */
function leaf(path: string): string {
    return path.split("/").at(-1) ?? path;
}

/**
 * The queries the MCP tools ask of the agent index. Every answer comes from the
 * index (and the files it points to); nothing about a component is hard-coded.
 */
export function createCatalog(client: ContentClient) {
    const index = (): Promise<AgentIndex> => client.index();

    async function projects(kind: KindFilter = "all"): Promise<Project[]> {
        const { projects } = await index();
        return kind === "all"
            ? projects
            : projects.filter((project) => project.kind === kind);
    }

    async function project(slug: string): Promise<Project> {
        const all = await projects();
        const wanted = normalize(slug);
        const found = all.find(
            (candidate) =>
                candidate.slug === wanted ||
                candidate.packages.some(
                    (pkg) => normalize(pkg.name) === wanted,
                ),
        );
        if (!found) {
            throw new ContentError(
                "NOT_FOUND",
                `There is no Fragiola project "${slug}".`,
                {
                    suggestion: `The projects are: ${all.map((candidate) => candidate.slug).join(", ")}.`,
                },
            );
        }
        return found;
    }

    async function entries(
        filter: {
            kind?: KindFilter;
            project?: string;
            group?: ComponentGroup;
        } = {},
    ): Promise<CatalogEntry[]> {
        const scope = filter.project
            ? [await project(filter.project)]
            : await projects(filter.kind);
        const result: CatalogEntry[] = [];
        for (const current of scope) {
            if (
                filter.kind &&
                filter.kind !== "all" &&
                current.kind !== filter.kind
            )
                continue;
            if (current.kind === "registry") {
                for (const component of current.components) {
                    if (filter.group && component.group !== filter.group)
                        continue;
                    result.push({
                        kind: "registry",
                        project: current,
                        component,
                    });
                }
                continue;
            }
            if (filter.group) continue;
            const api = current.pages.filter((page) => page.api);
            if (api.length === 0) {
                result.push({
                    kind: "library",
                    project: current,
                    page: undefined,
                });
            } else {
                for (const page of api)
                    result.push({ kind: "library", project: current, page });
            }
        }
        return result;
    }

    async function page(
        slug: string,
        path: string,
    ): Promise<{ project: Project; page: Page }> {
        const owner = await project(slug);
        const wanted = normalize(path).replace(/^docs\//, "");
        const found =
            owner.pages.find((candidate) => candidate.path === wanted) ??
            owner.pages.find(
                (candidate) => leaf(candidate.path) === leaf(wanted),
            );
        if (!found) {
            throw new ContentError(
                "NOT_FOUND",
                `${owner.title} has no docs page "${path}".`,
                {
                    suggestion: `Call get_docs with project "${owner.slug}" and no path to list its pages.`,
                },
            );
        }
        return { project: owner, page: found };
    }

    function markdown(target: Page): Promise<string> {
        return client.text(target.markdown);
    }

    async function overview(): Promise<string> {
        const { overview } = await index();
        return client.text(overview);
    }

    function registryItem(component: Component): Promise<RegistryItem> {
        return client.registryItem(component.item);
    }

    /**
     * Everything a name given by an agent can mean, most specific first. A name
     * can match both kinds (`dockable` is a library and a Fragiola UI component
     * built on it), and the agent should see both.
     */
    async function resolve(name: string): Promise<Resolved[]> {
        const all = await projects();
        const raw = name.trim().toLowerCase();
        const wanted = normalize(raw);
        const found: Resolved[] = [];

        // `dockable/tab`, `ui/select`: an entry inside one project.
        const [head, ...rest] = wanted.split("/");
        const owner =
            head && rest.length > 0
                ? all.find((candidate) => candidate.slug === head)
                : undefined;
        if (owner) {
            const path = rest.join("/");
            const component = owner.components.find(
                (candidate) => candidate.name === leaf(path),
            );
            if (component)
                found.push({ type: "component", project: owner, component });
            const match =
                owner.pages.find((candidate) => candidate.path === path) ??
                owner.pages.find(
                    (candidate) =>
                        candidate.api && leaf(candidate.path) === leaf(path),
                ) ??
                owner.pages.find(
                    (candidate) => leaf(candidate.path) === leaf(path),
                );
            if (match && owner.kind === "library")
                found.push({ type: "api-page", project: owner, page: match });
            return found;
        }

        // `@fragiola/dockable-react`, `dockable`: a library, or one of its packages.
        for (const candidate of all) {
            if (candidate.kind !== "library") continue;
            const packages = candidate.packages.filter(
                (pkg) => pkg.name.toLowerCase() === raw,
            );
            if (packages.length > 0)
                found.push({ type: "library", project: candidate, packages });
            else if (candidate.slug === wanted)
                found.push({
                    type: "library",
                    project: candidate,
                    packages: candidate.packages,
                });
        }

        // `select`, `@fragiola/select`: a Fragiola UI component.
        for (const candidate of all) {
            const component = candidate.components.find(
                (item) => item.name === wanted,
            );
            if (component)
                found.push({
                    type: "component",
                    project: candidate,
                    component,
                });
        }
        return found;
    }

    async function search(
        query: string,
        kind: KindFilter = "all",
        limit = 0,
    ): Promise<SearchHit[]> {
        const scope = await projects(kind);
        const components = scope.flatMap((owner) =>
            owner.components.map((component) => ({
                entry: { kind: "registry" as const, project: owner, component },
                name: component.name,
                title: component.title ?? "",
                description: component.description ?? "",
            })),
        );
        const pages = scope.flatMap((owner) =>
            owner.pages.map((current) => ({
                project: owner,
                page: current,
                name: `${owner.slug} ${current.path}`,
                title: current.title,
                description: current.description ?? "",
            })),
        );
        const keys = ["name", "title", "description"];
        const hits: SearchHit[] = [
            ...fuzzysort
                .go(query, components, { keys, threshold: 0.3 })
                .map((result) => ({
                    type: "component" as const,
                    entry: result.obj.entry,
                    // A component outranks a page with the same score: it is what the agent asked for.
                    score: result.score + 0.05,
                })),
            ...fuzzysort
                .go(query, pages, { keys, threshold: 0.3 })
                .map((result) => ({
                    type: "page" as const,
                    project: result.obj.project,
                    page: result.obj.page,
                    score: result.score,
                })),
        ].sort((a, b) => b.score - a.score);
        return limit > 0 ? hits.slice(0, limit) : hits;
    }

    return {
        index,
        projects,
        project,
        entries,
        page,
        markdown,
        overview,
        registryItem,
        resolve,
        search,
    };
}

export type Catalog = ReturnType<typeof createCatalog>;
