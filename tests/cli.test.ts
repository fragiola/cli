import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const bin = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));
const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("the fragiola binary", () => {
    it("prints the package version", () => {
        expect(
            execFileSync("node", [bin, "--version"], {
                encoding: "utf8",
            }).trim(),
        ).toBe(version);
    });

    it("describes the program in --help", () => {
        const help = execFileSync("node", [bin, "--help"], {
            encoding: "utf8",
        });
        expect(help).toContain("Usage: fragiola");
        expect(help).toContain("MCP server");
    });
});
