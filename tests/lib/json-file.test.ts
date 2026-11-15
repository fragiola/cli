import { describe, expect, it } from "vitest";
import { mergeJson } from "../../src/lib/json-file.ts";

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
