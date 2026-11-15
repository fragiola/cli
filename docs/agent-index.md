# The agent index (version 1)

fragiola.com publishes an **agent index**: the machine-readable view of the site that `fragiola mcp`
reads. `fragiola/www` emits it at build time from the project exports it already syncs. This file
is the contract between the two repositories, and `src/content/schema.ts` matches it field for
field.

Every path below is relative to the **base URL**: `https://fragiola.com` by default, or
`FRAGIOLA_URL` when it is set (tests, a local `pnpm serve` of www).

## Endpoints

| path                       | content                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `/agents/index.json`       | the index (below)                                                      |
| `/agents/overview.md`      | an overview of the ecosystem written for agents                        |
| `/agents/<slug>/<path>.md` | one docs page as Markdown: `# <title>`, the description, then the body |
| `/r/index.json`            | the shadcn registry index (already published by www)                   |
| `/r/<name>.json`           | one shadcn registry item, with its file contents                       |
| `/llms.txt`                | the [llms.txt](https://llmstxt.org) entry point (not read by the CLI)  |

## Two kinds of projects

| `kind`       | what it is                                                                                                    | how it is consumed                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `"registry"` | **Fragiola UI**: components distributed as **source code** through the shadcn registry. No npm package.       | `npx shadcn@latest add @fragiola/<name>` once `components.json` lists the `@fragiola` registry. The code is the project's own from then on. |
| `"library"`  | A headless **npm library**: a framework-free core `@fragiola/<x>` and adapters such as `@fragiola/<x>-react`. | `npm install` the core and the adapter, then import them.                                                                                   |

## `/agents/index.json`

```json
{
    "version": 1,
    "site": "https://fragiola.com",
    "overview": "/agents/overview.md",
    "registry": {
        "namespace": "@fragiola",
        "index": "/r/index.json",
        "item": "/r/{name}.json",
        "componentsJson": {
            "@fragiola": { "url": "https://fragiola.com/r/{name}.json" }
        }
    },
    "projects": [
        {
            "slug": "dockable",
            "title": "Dockable",
            "description": "Headless dockable panels: tabs, tabsets, splitters, borders and popouts.",
            "kind": "library",
            "packages": [
                { "name": "@fragiola/dockable", "role": "core" },
                {
                    "name": "@fragiola/dockable-react",
                    "role": "adapter",
                    "framework": "react"
                }
            ],
            "frameworks": ["react"],
            "repository": "https://github.com/fragiola/dockable",
            "keywords": [],
            "docs": "/dockable/docs/",
            "pages": [
                {
                    "path": "api/tab",
                    "title": "Tab",
                    "description": "The tab primitive.",
                    "section": "API: primitives (@fragiola/dockable-react)",
                    "api": true,
                    "url": "/dockable/docs/api/tab/",
                    "markdown": "/agents/dockable/api/tab.md"
                }
            ],
            "examples": [
                {
                    "id": "ide",
                    "title": "IDE layout",
                    "description": "…",
                    "level": "apps",
                    "url": "/dockable/examples/ide/"
                }
            ],
            "components": []
        }
    ]
}
```

### Root

| field      | type        | required | notes                                              |
| ---------- | ----------- | -------- | -------------------------------------------------- |
| `version`  | `1`         | yes      | the major version of this contract                 |
| `site`     | string      | yes      | the canonical origin of the site                   |
| `overview` | path        | yes      | the Markdown overview                              |
| `registry` | object      | no       | present when a project publishes a shadcn registry |
| `projects` | `Project[]` | yes      | in the order of `projects.json`                    |

### `registry`

| field            | type                       | notes                                                      |
| ---------------- | -------------------------- | ---------------------------------------------------------- |
| `namespace`      | string                     | `@fragiola`                                                |
| `index`          | path                       | the registry index                                         |
| `item`           | path with `{name}`         | one item                                                   |
| `componentsJson` | `{ [namespace]: { url } }` | the `registries` entry a project adds to `components.json` |

### `Project`

| field         | type                        | required  | notes                                                |
| ------------- | --------------------------- | --------- | ---------------------------------------------------- |
| `slug`        | string                      | yes       | the site path (`/<slug>/`)                           |
| `title`       | string                      | yes       |                                                      |
| `description` | string                      | yes       |                                                      |
| `kind`        | `"registry"` \| `"library"` | yes       | see [Two kinds of projects](#two-kinds-of-projects)  |
| `packages`    | `Package[]`                 | no (`[]`) | empty for `registry`                                 |
| `frameworks`  | string[]                    | no (`[]`) | from the project's `project.json`                    |
| `repository`  | URL                         | no        |                                                      |
| `keywords`    | string[]                    | no (`[]`) |                                                      |
| `docs`        | path                        | yes       | the project's docs root                              |
| `pages`       | `Page[]`                    | no (`[]`) | every docs page except the landing, in sidebar order |
| `examples`    | `Example[]`                 | no (`[]`) | metadata only, no code                               |
| `components`  | `Component[]`               | no (`[]`) | only for `registry`                                  |

### `Package`

| field       | type                    | required | notes                     |
| ----------- | ----------------------- | -------- | ------------------------- |
| `name`      | string                  | yes      | the npm name              |
| `role`      | `"core"` \| `"adapter"` | yes      |                           |
| `framework` | string                  | no       | for adapters (`react`, …) |

### `Page`

| field         | type    | required | notes                                                          |
| ------------- | ------- | -------- | -------------------------------------------------------------- |
| `path`        | string  | yes      | the page path under the docs root, without slashes (`api/tab`) |
| `title`       | string  | yes      |                                                                |
| `description` | string  | no       |                                                                |
| `section`     | string  | yes      | the sidebar section label                                      |
| `api`         | boolean | yes      | `true` when `section` starts with `API`                        |
| `url`         | path    | yes      | the HTML page                                                  |
| `markdown`    | path    | yes      | the Markdown page                                              |

### `Example`

| field         | type   | required |
| ------------- | ------ | -------- |
| `id`          | string | yes      |
| `title`       | string | yes      |
| `description` | string | no       |
| `level`       | string | no       |
| `url`         | path   | yes      |

### `Component` (Fragiola UI)

| field         | type                                                               | required | notes                                                                                |
| ------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| `name`        | string                                                             | yes      | the registry name (`select`); added as `@fragiola/<name>`                            |
| `type`        | string                                                             | yes      | the registry type (`registry:ui`, `registry:lib`, `registry:file`, `registry:theme`) |
| `group`       | `component` \| `atom` \| `family` \| `lib` \| `theme` \| `palette` | yes      | from the item's file targets (`@ui/`, `@components/atoms/`, `@components/families/`) |
| `title`       | string                                                             | no       |                                                                                      |
| `description` | string                                                             | no       |                                                                                      |
| `docs`        | string \| `null`                                                   | yes      | the path of its docs page in the project's `pages`, or `null`                        |
| `item`        | path                                                               | yes      | its `/r/<name>.json`                                                                 |

## Markdown pages

Each docs page (except the landing) is published as Markdown at its `markdown` path:

1. `# <title>`, then the description as a paragraph.
2. The body, with the site's MDX vocabulary lowered to Markdown:
   - `<Example id>` becomes a link to the example;
   - `<InstallCommand item>` becomes `npx shadcn@latest add @fragiola/<item>`;
   - `<Callout>` becomes a blockquote with its title;
   - `<Tabs>`/`<Tab>` become one sub-heading per tab;
   - `<Steps>`/`<Step>` become a numbered list;
   - `<Cards>`/`<Card>` become a list of links;
   - `<Framework>` keeps its content, labelled with the framework.
3. Links are absolute URLs on the site.

## Compatibility

- A reader accepts any `version: 1` index and **ignores fields it does not know**. New optional
  fields do not change the version.
- Removing or renaming a field, or changing its meaning, is a new major version. A CLI that
  receives a newer major version than it reads says so and asks to upgrade (`fragiola@latest`).
- The output is deterministic: the same exports give the same bytes (no timestamps).
