import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type JsonObject = { [key: string]: unknown };

function isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges `patch` into `base`: objects merge key by key, anything else
 * (arrays included) is replaced by the patch.
 */
export function mergeJson(base: JsonObject, patch: JsonObject): JsonObject {
    const result: JsonObject = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        const current = result[key];
        result[key] =
            isObject(current) && isObject(value)
                ? mergeJson(current, value)
                : value;
    }
    return result;
}

export class InvalidJsonFileError extends Error {
    readonly file: string;

    constructor(file: string, cause: unknown) {
        super(
            `${file} is not valid JSON. Fix it or remove it, then run the command again.`,
            { cause },
        );
        this.name = "InvalidJsonFileError";
        this.file = file;
    }
}

/** Reads a JSON object file; a missing file is an empty object, invalid JSON an error. */
export async function readJsonFile(file: string): Promise<JsonObject> {
    let text: string;
    try {
        text = await readFile(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
        throw error;
    }
    if (text.trim() === "") return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (cause) {
        throw new InvalidJsonFileError(file, cause);
    }
    if (!isObject(parsed))
        throw new InvalidJsonFileError(file, new TypeError("not an object"));
    return parsed;
}

/** Merges `patch` into the JSON file (created with its folders when missing). */
export async function mergeJsonFile(
    file: string,
    patch: JsonObject,
): Promise<JsonObject> {
    const merged = mergeJson(await readJsonFile(file), patch);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
}
