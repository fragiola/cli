import { describe, expect, it } from "vitest";
import {
    fileProblems,
    type Manifest,
    tarballsOption,
    targets,
} from "../../scripts/check-package.ts";

const manifest: Manifest = {
    name: "fragiola",
    version: "0.1.0",
    bin: { fragiola: "./dist/cli.mjs" },
    exports: {
        ".": { types: "./dist/index.d.mts", default: "./dist/index.mjs" },
        "./package.json": "./package.json",
    },
};

const shipped = new Set([
    "./package.json",
    "./README.md",
    "./LICENSE",
    "./dist/cli.mjs",
    "./dist/index.mjs",
    "./dist/index.d.mts",
]);

describe("tarballsOption", () => {
    it("reads --tarballs <dir> and --tarballs=<dir>", () => {
        expect(tarballsOption([])).toBeUndefined();
        expect(tarballsOption(["--tarballs", "out"])).toBe("out");
        expect(tarballsOption(["--tarballs=out"])).toBe("out");
    });

    it("throws on a missing directory or an unknown argument", () => {
        expect(() => tarballsOption(["--tarballs"])).toThrow(
            "needs a directory",
        );
        expect(() => tarballsOption(["--tarballs="])).toThrow(
            "needs a directory",
        );
        expect(() => tarballsOption(["--fast"])).toThrow("unknown argument");
    });
});

describe("targets", () => {
    it("collects every target of bin and exports, as ./path", () => {
        expect(targets("dist/cli.mjs")).toEqual(["./dist/cli.mjs"]);
        expect(targets(manifest.exports)).toEqual([
            "./dist/index.d.mts",
            "./dist/index.mjs",
            "./package.json",
        ]);
        expect(targets(undefined)).toEqual([]);
    });
});

describe("fileProblems", () => {
    it("accepts dist/ and the manifest files, with every target packed", () => {
        expect(fileProblems(manifest, shipped)).toEqual([]);
    });

    it("reports a file outside dist/, a target not packed and a missing manifest file", () => {
        const files = new Set(shipped);
        files.add("./src/cli.ts");
        files.delete("./dist/cli.mjs");
        files.delete("./LICENSE");
        expect(fileProblems(manifest, files)).toEqual([
            "./src/cli.ts is packed: only dist/ and the manifest ship",
            "./dist/cli.mjs is a target but is not packed",
            "./LICENSE is not packed",
        ]);
    });
});
