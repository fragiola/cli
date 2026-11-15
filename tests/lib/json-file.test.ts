import { describe, expect, it } from "vitest";
import { mergeJson, withoutPath } from "../../src/lib/json-file.ts";

describe("mergeJson", () => {
    it("merges objects key by key and replaces arrays and values", () => {
        expect(
            mergeJson(
                { a: { b: 1, c: [1, 2] }, d: "x", keep: true },
                { a: { c: [3], e: 2 }, d: { f: 1 } },
            ),
        ).toEqual({ a: { b: 1, c: [3], e: 2 }, d: { f: 1 }, keep: true });
    });
});

describe("withoutPath", () => {
    it("removes the value at a path without changing the input", () => {
        const base = { a: { b: 1, c: 2 }, d: 3 };
        expect(withoutPath(base, ["a", "b"])).toEqual({ a: { c: 2 }, d: 3 });
        expect(withoutPath(base, ["x", "y"])).toBe(base);
        expect(base).toEqual({ a: { b: 1, c: 2 }, d: 3 });
    });
});
