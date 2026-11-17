import type { CatalogEntry, Resolved, SearchHit } from "../content/catalog.ts";
import { ContentError } from "../content/errors.ts";
import type {
    Component,
    Package,
    Page,
    Project,
    Registry,
    RegistryItem,
} from "../content/schema.ts";

/**
 * Every text the tools return. Pure functions, plain Markdown, stable output:
 * agents read it, so each item says whether it is source code or an npm
 * library, and what to call or run next.
 */

export const SHADCN_ADD = "npx shadcn@latest add";

export type Window = { offset: number; limit: number };

export const DEFAULT_LIMIT = 100;

/** The slice of `items` the window asks for (`limit: 0` means everything). */
export function paginate<T>(items: T[], window: Window): T[] {
    const end = window.limit > 0 ? window.offset + window.limit : undefined;
    return items.slice(window.offset, end);
}

function pageFooter(total: number, shown: number, window: Window): string {
    if (shown === 0) return "";
    const first = window.offset + 1;
    const last = window.offset + shown;
    const lines = [`Showing ${first}–${last} of ${total}.`];
    if (last < total)
        lines.push(
            `More items available. Use offset: ${last} to see the next ones.`,
        );
    return lines.join("\n");
}

export function absolute(site: string, path: string): string {
    return /^https?:\/\//.test(path)
        ? path
        : `${site.replace(/\/+$/, "")}${path}`;
}

/** `@fragiola/select`: the name a Fragiola UI component is added with. */
export function registryName(
    component: Component,
    namespace = "@fragiola",
): string {
    return `${namespace}/${component.name}`;
}

export function addCommand(names: string[]): string {
    return `${SHADCN_ADD} ${names.join(" ")}`;
}

/** `npm install …` and `pnpm add …` for a set of packages. */
export function installCommands(packages: string[]): [string, string] {
    const list = packages.join(" ");
    return [`npm install ${list}`, `pnpm add ${list}`];
}

/** One way to install a library: for one framework (its adapter), or without one (the core). */
export interface LibraryInstall {
    /** `react`, `vue`, …; undefined for the core alone */
    framework: string | undefined;
    package: string;
}

/**
 * How a library is installed, the way its docs say: the adapter for the project's framework, which
 * depends on the core and re-exports it, never the core and adapters together. One line per
 * adapter, then the core alone for framework-free use. `packages` are the ones asked for (a
 * package name narrows to it); `framework` keeps only that framework's adapter.
 */
export function libraryInstalls(
    packages: Package[],
    framework?: string,
): LibraryInstall[] {
    const adapters: LibraryInstall[] = packages
        .filter((pkg) => pkg.role === "adapter")
        .map((pkg) => ({
            framework: pkg.framework ?? frameworkOf(pkg.name),
            package: pkg.name,
        }));
    const core: LibraryInstall[] = packages
        .filter((pkg) => pkg.role === "core")
        .map((pkg) => ({ framework: undefined, package: pkg.name }));
    // A core asked for by name stays the core: a framework narrows adapters only.
    if (framework !== undefined && adapters.length > 0) {
        const wanted = framework.trim().toLowerCase();
        return adapters.filter(
            (line) => line.framework?.toLowerCase() === wanted,
        );
    }
    return [...adapters, ...core];
}

/** `@fragiola/dockable-react` → `react`: the adapter's framework when the index omits it. */
function frameworkOf(name: string): string | undefined {
    return name.match(/-([a-z]+)$/)?.[1];
}

/** `react` / `no framework (the core alone)`: the label of an install line. */
export function installLabel(line: LibraryInstall): string {
    return line.framework ?? "no framework (the core alone)";
}

/** The adapters' frameworks of a library, for "it has: react, vue". */
export function adapterFrameworks(packages: Package[]): string[] {
    return libraryInstalls(packages)
        .map((line) => line.framework)
        .filter((name): name is string => name !== undefined);
}

const ADAPTER_NOTE =
    "Install the adapter for the project's framework: it depends on the core and re-exports it, so the app imports everything from the adapter. Never install several adapters, nor the core next to an adapter.";

/** The package an API page documents: the one named in its section label, else the core. */
export function pagePackage(
    project: Project,
    page: Page | undefined,
): string | undefined {
    const named = page?.section.match(/\((@[^)\s]+)\)/)?.[1];
    if (named) return named;
    return (
        project.packages.find((pkg) => pkg.role === "core")?.name ??
        project.packages[0]?.name
    );
}

export function componentTag(): string {
    return "[ui · source code]";
}

export function libraryTag(packages: string[]): string {
    return `[library · ${packages.length > 0 ? packages.join(", ") : "npm package"}]`;
}

function kindLabel(project: Project): string {
    return project.kind === "registry"
        ? "Fragiola UI: source code through the shadcn registry"
        : "library: npm packages";
}

function packageLine(packages: Package[]): string {
    return packages
        .map((pkg) =>
            pkg.role === "adapter" && pkg.framework
                ? `\`${pkg.name}\` (${pkg.framework} adapter)`
                : `\`${pkg.name}\` (${pkg.role})`,
        )
        .join(", ");
}

/** The "also a library" hint: the install of one framework, and where the others are. */
function alsoLibrary(project: Project): string {
    const [first] = libraryInstalls(project.packages);
    if (!first) return "see get_component";
    return `\`${installCommands([first.package])[0]}\` for ${installLabel(first)} (get_install_command lists every framework)`;
}

function componentsJsonSnippet(registry: Registry | undefined): string {
    const registries = registry?.componentsJson ?? {
        "@fragiola": { url: "https://fragiola.com/r/{name}.json" },
    };
    return ["```json", JSON.stringify({ registries }, null, 4), "```"].join(
        "\n",
    );
}

export function formatProjects(
    projects: Project[],
    site: string,
    registry?: Registry,
): string {
    if (projects.length === 0) return "No Fragiola projects are published.";
    const lines: string[] = [`Fragiola has ${projects.length} projects.`, ""];
    for (const project of projects) {
        lines.push(
            `## ${project.title} (\`${project.slug}\`): ${kindLabel(project)}`,
            "",
        );
        if (project.description) lines.push(project.description, "");
        if (project.kind === "registry") {
            lines.push(
                `- Components: ${project.components.length} (list_components with project "${project.slug}")`,
                `- Setup: add the registry to components.json, then \`${SHADCN_ADD} ${registry?.namespace ?? "@fragiola"}/<name>\``,
            );
        } else {
            lines.push(
                `- Packages: ${packageLine(project.packages) || "none listed"}`,
            );
            const installs = libraryInstalls(project.packages);
            if (installs.length > 0) {
                lines.push(
                    "- Install (one line, for the project's framework; the adapter brings the core):",
                    ...installs.map(
                        (line) =>
                            `  - ${installLabel(line)}: \`${installCommands([line.package])[0]}\``,
                    ),
                );
            }
            const api = project.pages.filter((page) => page.api).length;
            lines.push(
                api > 0
                    ? `- API pages: ${api} (get_api with project "${project.slug}")`
                    : `- API pages: none; the concepts and guides document it (get_docs with project "${project.slug}")`,
            );
        }
        if (project.frameworks.length > 0)
            lines.push(`- Frameworks: ${project.frameworks.join(", ")}`);
        lines.push(
            `- Docs: ${absolute(site, project.docs)} (${project.pages.length} pages, get_docs)`,
        );
        if (project.examples.length > 0)
            lines.push(`- Examples: ${project.examples.length}`);
        if (project.repository)
            lines.push(`- Repository: ${project.repository}`);
        lines.push("");
    }
    return lines.join("\n").trimEnd();
}

function entryLines(
    entry: CatalogEntry,
    namespace: string | undefined,
): string[] {
    if (entry.kind === "registry") {
        const { component } = entry;
        const about = component.description
            ? ` - ${component.description}`
            : "";
        return [
            `- ${component.name} (${component.group})${about} ${componentTag()}`,
            `  Add: \`${addCommand([registryName(component, namespace)])}\``,
        ];
    }
    const { project, page } = entry;
    if (!page) {
        return [
            `- ${project.slug}: ${project.title} - ${project.description} ${libraryTag(project.packages.map((pkg) => pkg.name))}`,
            `  Details: get_component { names: ["${project.slug}"] }`,
        ];
    }
    const pkg = pagePackage(project, page);
    const about = page.description ? ` - ${page.description}` : "";
    return [
        `- ${project.slug}/${page.path}: ${page.title}${about} ${libraryTag(pkg ? [pkg] : [])}`,
        `  Details: get_api { project: "${project.slug}", name: "${page.path}" }`,
    ];
}

export function formatEntries(
    entries: CatalogEntry[],
    window: Window,
    namespace: string | undefined,
): string {
    if (entries.length === 0) return "No components match these filters.";
    const shown = paginate(entries, window);
    if (shown.length === 0) {
        return `There are ${entries.length} components; offset ${window.offset} is past the end.`;
    }
    const ui = shown.filter((entry) => entry.kind === "registry");
    const libraries = shown.filter((entry) => entry.kind === "library");
    const lines: string[] = [
        `Found ${entries.length} Fragiola components.`,
        "",
    ];
    if (ui.length > 0) {
        lines.push(
            "## Fragiola UI: source code (copied into the project with the shadcn CLI)",
            "",
            ...ui.flatMap((entry) => entryLines(entry, namespace)),
            "",
        );
    }
    if (libraries.length > 0) {
        lines.push(
            "## Libraries: npm packages (installed and imported)",
            "",
            ...libraries.flatMap((entry) => entryLines(entry, namespace)),
            "",
        );
    }
    lines.push(pageFooter(entries.length, shown.length, window));
    return lines.join("\n").trimEnd();
}

export function formatSearch(
    query: string,
    hits: SearchHit[],
    window: Window,
    namespace: string | undefined,
): string {
    if (hits.length === 0) {
        return `No Fragiola components or docs pages match "${query}". Try a broader term, or list_components.`;
    }
    const shown = paginate(hits, window);
    if (shown.length === 0) {
        return `There are ${hits.length} results for "${query}"; offset ${window.offset} is past the end. Use a smaller offset.`;
    }
    const lines: string[] = [
        `Found ${hits.length} results for "${query}".`,
        "",
    ];
    for (const hit of shown) {
        if (hit.type === "component") {
            lines.push(...entryLines(hit.entry, namespace));
            lines.push(
                `  Docs and files: get_component { names: ["${hit.entry.component.name}"] }`,
            );
            continue;
        }
        const { project, page } = hit;
        const tag =
            project.kind === "registry"
                ? "[ui docs]"
                : `[library docs · ${pagePackage(project, page) ?? project.slug}]`;
        const about = page.description ? ` - ${page.description}` : "";
        lines.push(
            `- ${project.title} › ${page.section} › ${page.title}${about} ${tag}`,
            `  Read: get_docs { project: "${project.slug}", path: "${page.path}" }`,
        );
    }
    lines.push("", pageFooter(hits.length, shown.length, window));
    return lines.join("\n").trimEnd();
}

export function formatComponent(input: {
    project: Project;
    component: Component;
    item: RegistryItem;
    docs: string | undefined;
    includeCode: boolean;
    site: string;
    registry: Registry | undefined;
}): string {
    const { project, component, item, docs, includeCode, site, registry } =
        input;
    const name = registryName(component, registry?.namespace);
    const lines: string[] = [
        `## ${component.title ?? component.name} (Fragiola UI \`${component.name}\`) ${componentTag()}`,
        "",
        `Kind: Fragiola UI, source code from the shadcn registry. \`${name}\` is its registry name for the shadcn CLI, not an npm package: the code is copied into the project, which owns it.`,
        "",
    ];
    const description = item.description ?? component.description;
    if (description) lines.push(description, "");
    lines.push(`- Group: ${component.group} (${item.type})`);
    lines.push(`- Add: \`${addCommand([name])}\``);
    if (item.registryDependencies.length > 0) {
        lines.push(
            `- Registry dependencies (added with it): ${item.registryDependencies.join(", ")}`,
        );
    }
    if (item.dependencies.length > 0)
        lines.push(
            `- npm dependencies (installed with it): ${item.dependencies.join(", ")}`,
        );
    if (item.devDependencies.length > 0)
        lines.push(
            `- npm dev dependencies: ${item.devDependencies.join(", ")}`,
        );
    if (component.docs)
        lines.push(
            `- Docs: ${absolute(site, `${project.docs}${component.docs}/`)}`,
        );
    lines.push("", `### Files (${item.files.length})`, "");
    for (const file of item.files) {
        lines.push(`- ${file.path}${file.target ? ` → ${file.target}` : ""}`);
    }
    if (includeCode) {
        for (const file of item.files) {
            if (file.content === undefined) continue;
            const language = file.path.split(".").at(-1) ?? "";
            lines.push(
                "",
                `#### ${file.path}`,
                "",
                `\`\`\`${language}`,
                file.content.trimEnd(),
                "```",
            );
        }
    } else if (item.files.length > 0) {
        lines.push("", "Call again with include_code: true for the source.");
    }
    if (docs) lines.push("", "### Documentation", "", docs.trim());
    return lines.join("\n");
}

export function formatLibrary(
    project: Project,
    packages: Package[],
    site: string,
): string {
    const names = (packages.length > 0 ? packages : project.packages).map(
        (pkg) => pkg.name,
    );
    const installs = libraryInstalls(
        packages.length > 0 ? packages : project.packages,
    );
    const api = project.pages.filter((page) => page.api);
    const lines: string[] = [
        `## ${project.title} (\`${project.slug}\`) ${libraryTag(names)}`,
        "",
        "Kind: Fragiola library, npm packages to install and import. Headless: it ships behaviour and accessibility, never CSS.",
        "",
    ];
    if (project.description) lines.push(project.description, "");
    lines.push(`- Packages: ${packageLine(project.packages) || "none listed"}`);
    if (installs.length > 0) {
        lines.push(
            "- Install (one line, for the project's framework; the adapter brings the core):",
            ...installs.map((line) => {
                const [npm, pnpm] = installCommands([line.package]);
                return `  - ${installLabel(line)}: \`${npm}\` (or \`${pnpm}\`)`;
            }),
        );
    }
    lines.push(`- Docs: ${absolute(site, project.docs)}`);
    if (project.repository) lines.push(`- Repository: ${project.repository}`);
    lines.push("");
    if (api.length > 0) {
        lines.push(
            `### API pages (${api.length})`,
            "",
            ...api.map((page) => apiLine(project, page)),
        );
    } else {
        lines.push(
            "### API",
            "",
            `${project.title} has no API reference pages. Its concepts and guides document the model and the primitives: get_docs { project: "${project.slug}" }.`,
        );
    }
    return lines.join("\n");
}

function apiLine(project: Project, page: Page): string {
    const about = page.description ? ` - ${page.description}` : "";
    return `- ${page.path}: ${page.title}${about} (${page.section}). get_api { project: "${project.slug}", name: "${page.path}" }`;
}

export function formatApiList(project: Project): string {
    if (project.kind === "registry") {
        return `${project.title} is source code, not a library: its components have no API package. Read a component with get_component, or its docs with get_docs { project: "${project.slug}" }.`;
    }
    const api = project.pages.filter((page) => page.api);
    if (api.length === 0) {
        const concepts = project.pages.filter((page) =>
            /concept|model|api/i.test(`${page.section} ${page.path}`),
        );
        const lines = [
            `${project.title} has no API reference pages yet. Its concept pages document the model and the primitives:`,
            "",
            ...(concepts.length > 0 ? concepts : project.pages).map(
                (page) =>
                    `- ${page.path}: ${page.title}. get_docs { project: "${project.slug}", path: "${page.path}" }`,
            ),
        ];
        return lines.join("\n");
    }
    const sections = groupBySection(api);
    const lines: string[] = [
        `${project.title} API reference (${api.length} pages).`,
        "",
    ];
    for (const [section, pages] of sections) {
        lines.push(
            `## ${section}`,
            "",
            ...pages.map((page) => apiLine(project, page)),
            "",
        );
    }
    return lines.join("\n").trimEnd();
}

function groupBySection(pages: Page[]): Map<string, Page[]> {
    const sections = new Map<string, Page[]>();
    for (const page of pages) {
        const list = sections.get(page.section) ?? [];
        list.push(page);
        sections.set(page.section, list);
    }
    return sections;
}

export function formatPageList(project: Project, site: string): string {
    if (project.pages.length === 0)
        return `${project.title} has no docs pages.`;
    const lines: string[] = [
        `${project.title} docs (${project.pages.length} pages, ${kindLabel(project)}). Read one with get_docs { project: "${project.slug}", path: "<path>" }.`,
        "",
    ];
    for (const [section, pages] of groupBySection(project.pages)) {
        lines.push(`## ${section}`, "");
        for (const page of pages) {
            const about = page.description ? ` - ${page.description}` : "";
            lines.push(`- ${page.path}: ${page.title}${about}`);
        }
        lines.push("");
    }
    lines.push(`Site: ${absolute(site, project.docs)}`);
    return lines.join("\n");
}

export function formatPage(
    project: Project,
    page: Page,
    markdown: string,
    site: string,
): string {
    const kind =
        project.kind === "registry"
            ? componentTag()
            : libraryTag(
                  page.api
                      ? [pagePackage(project, page) ?? project.slug]
                      : project.packages.map((pkg) => pkg.name),
              );
    return [
        `Source: ${absolute(site, page.url)} (${project.title} › ${page.section}) ${kind}`,
        "",
        markdown.trim(),
    ].join("\n");
}

export function formatInstall(
    resolved: { name: string; found: Resolved[] }[],
    registry: Registry | undefined,
    framework?: string,
): string {
    const components = new Set<string>();
    const libraries = new Map<
        string,
        { project: Project; packages: Package[] }
    >();
    const unknown: string[] = [];
    const alsoNamed: string[] = [];
    for (const { name, found } of resolved) {
        const first = found[0];
        if (!first) {
            unknown.push(name);
            continue;
        }
        // The first meaning is installed (a library slug or package name before
        // a component of the same name); the others are named, never dropped.
        if (first.type === "component") {
            components.add(registryName(first.component, registry?.namespace));
        } else {
            const { project } = first;
            const asked =
                first.type === "library" ? first.packages : project.packages;
            const entry = libraries.get(project.slug) ?? {
                project,
                packages: [],
            };
            for (const pkg of asked) {
                if (!entry.packages.includes(pkg)) entry.packages.push(pkg);
            }
            libraries.set(project.slug, entry);
        }
        for (const other of found.slice(1)) {
            alsoNamed.push(
                other.type === "component"
                    ? `"${name}" is also a Fragiola UI component (source code): \`${addCommand([registryName(other.component, registry?.namespace)])}\`.`
                    : `"${name}" is also the ${other.project.title} library (npm packages): ${alsoLibrary(other.project)}.`,
            );
        }
    }
    const lines: string[] = [];
    if (components.size > 0) {
        lines.push(
            "## Fragiola UI (source code)",
            "",
            "1. Add the @fragiola registry to components.json (once per project):",
            "",
            componentsJsonSnippet(registry),
            "",
            "2. Add the components (the shadcn CLI copies their source and their registry dependencies):",
            "",
            "```bash",
            addCommand([...components]),
            "```",
            "",
        );
    }
    if (libraries.size > 0) {
        lines.push("## Libraries (npm packages)", "", ADAPTER_NOTE, "");
        for (const { project, packages } of libraries.values()) {
            const installs = libraryInstalls(packages, framework);
            lines.push(`### ${project.title} (\`${project.slug}\`)`, "");
            if (installs.length === 0) {
                const known = adapterFrameworks(project.packages);
                lines.push(
                    `${project.title} has no ${framework} adapter. Its frameworks: ${known.join(", ") || "none (the core alone)"}.`,
                    "",
                );
                continue;
            }
            lines.push("```bash");
            for (const line of installs) {
                const [npm, pnpm] = installCommands([line.package]);
                lines.push(`# ${installLabel(line)}`, npm, `# or: ${pnpm}`);
            }
            lines.push("```", "");
        }
    }
    if (alsoNamed.length > 0) {
        lines.push(
            "## Same name, other kind",
            "",
            ...alsoNamed.map((line) => `- ${line}`),
            "",
        );
    }
    if (unknown.length > 0) {
        lines.push(
            `Not found: ${unknown.join(", ")}. Use search_fragiola or list_components to find the right names.`,
        );
    }
    return lines.join("\n").trimEnd();
}

export function formatNotFound(names: string[]): string {
    return `No Fragiola component, library or package is named ${names.map((name) => `"${name}"`).join(", ")}. Use search_fragiola or list_components to find the right names.`;
}

export function formatError(error: unknown): string {
    if (error instanceof ContentError) {
        const lines = [`Error (${error.code}): ${error.message}`];
        if (error.suggestion) lines.push("", `Suggestion: ${error.suggestion}`);
        if (process.env.FRAGIOLA_URL)
            lines.push(
                "",
                `FRAGIOLA_URL is set to ${process.env.FRAGIOLA_URL}.`,
            );
        return lines.join("\n");
    }
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
