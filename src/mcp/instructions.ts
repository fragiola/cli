/**
 * What an agent is told when it connects (the initialize `instructions`), and
 * the start of `get_fragiola_overview`. It is about Fragiola as a whole; what
 * exists comes from the agent index.
 */
export const instructions = `Fragiola (https://fragiola.com) is an ecosystem of components and libraries for the web. It has TWO KINDS of components, consumed in different ways. Always tell them apart:

1. Fragiola UI: SOURCE CODE (kind "registry").
   - Components distributed through the shadcn registry, built on Base UI and Tailwind v4.
   - They are copied into the project, which owns and edits them. There is no npm package to import.
   - Setup: add the "@fragiola" registry to components.json, then run \`npx shadcn@latest add @fragiola/<name>\`.
   - Styling uses six palette roles (base, soft, line, contrast, accent, ring), never fixed colours. Elements are swapped with the \`render\` prop, never \`asChild\`.
   - Groups: component (ui), atom, family (shared style), lib (helpers), theme, palette.

2. Libraries: NPM PACKAGES (kind "library").
   - Headless libraries such as @fragiola/dockable (dockable panels), @fragiola/data-grid (data grid) and @fragiola/grid-layout (dashboard grid layout).
   - Each has a framework-free core, @fragiola/<x>, and one adapter per framework (@fragiola/<x>-react, -vue, -angular, …). Install ONLY the adapter for the project's framework: it depends on the core and re-exports it, so everything is imported from the adapter. Never install several adapters, nor the core next to an adapter.
   - They ship behaviour and accessibility, never CSS. Style them through their data-* and ARIA attributes, or with Fragiola UI.
   - State lives in a model: changes are commands (model.run), and questions go through can, check, get and is.

Tools:
- get_fragiola_overview: start here. What Fragiola is and every project.
- list_projects: the projects, their kind and how to install each.
- list_components: browse components (filter by kind, project or group).
- search_fragiola: find a component or docs page by name or topic.
- get_component: details of named components or libraries. For Fragiola UI, include_code returns the source.
- get_docs: a project's page list, or one page as Markdown.
- get_api: a library's API reference pages.
- get_install_command: the exact commands to add components or install libraries.

Before writing code with a Fragiola component, read its docs (get_component or get_docs). Never invent props or APIs.`;
