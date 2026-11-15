import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        cli: "src/cli.ts",
        index: "src/index.ts",
        mcp: "src/mcp/index.ts",
    },
    format: "esm",
    platform: "node",
    target: "node24",
    dts: true,
    clean: true,
});
