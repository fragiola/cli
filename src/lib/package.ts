import packageJson from "../../package.json" with { type: "json" };

/** The name and version the CLI and the MCP server report. */
export const pkg = {
    name: packageJson.name,
    version: packageJson.version,
} as const;
