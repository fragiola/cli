// Fails when the package cannot be published as it is. Run by `pnpm check:package`, after the
// build. The package is packed with pnpm (the way the release publishes it), then:
//
// - the tarball holds only `dist/`, `package.json`, `README.md` and `LICENSE`, and every target of
//   `bin` and `exports` is a file of it;
// - publint (strict) and attw (`esm-only` profile) pass on the tarball;
// - the smoke test: a scratch project outside the repository installs the tarball with npm (what
//   `npx fragiola@latest` does for a user), then `fragiola --version` prints the packed version,
//   both exports (`fragiola`, `fragiola/mcp`) import, and `fragiola mcp` answers an MCP
//   `initialize` and `tools/list` over stdio with every tool. The install needs the npm
//   registry (for the dependencies); the handshake does not reach fragiola.com, which the tools
//   fetch only when called.
//
// `--tarballs <dir>` checks the tarball found in `dir` (at any depth) instead of packing: the
// release workflow passes the directory `changeset pack` wrote, so what is checked is what is
// published.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { toolNames } from "../src/mcp/index.ts";

const root = join(import.meta.dirname, "..");

/** What the tarball may hold, besides `dist/`. */
const ALLOWED_FILES = ["./package.json", "./README.md", "./LICENSE"];

/** The directory of `--tarballs <dir>` (or `--tarballs=<dir>`), if given; any other argument throws. */
export function tarballsOption(args: string[]): string | undefined {
    let dir: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--tarballs") {
            dir = args[++i];
            if (dir === undefined || dir.startsWith("--")) {
                throw new Error("--tarballs needs a directory");
            }
        } else if (arg?.startsWith("--tarballs=")) {
            dir = arg.slice("--tarballs=".length);
            if (dir === "") throw new Error("--tarballs needs a directory");
        } else {
            throw new Error(`unknown argument: ${arg}`);
        }
    }
    return dir;
}

/** The `.tgz` files under `dir`, at any depth, sorted. */
export function findTarballs(dir: string): string[] {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
        .map((entry) => join(entry.parentPath, entry.name))
        .sort();
}

/** Every target of `bin` and `exports`, at any depth, as `./path`. */
export function targets(value: unknown): string[] {
    if (typeof value === "string") {
        return [value.startsWith("./") ? value : `./${value}`];
    }
    if (value === null || typeof value !== "object") return [];
    return Object.values(value).flatMap(targets);
}

export interface Manifest {
    name: string;
    version: string;
    bin?: unknown;
    exports?: unknown;
}

/** What is wrong with a tarball's files: a file it should not ship, a target it does not ship. */
export function fileProblems(manifest: Manifest, files: Set<string>): string[] {
    const extra = [...files]
        .filter(
            (file) =>
                !file.startsWith("./dist/") && !ALLOWED_FILES.includes(file),
        )
        .map((file) => `${file} is packed: only dist/ and the manifest ship`);
    const missing = [...targets(manifest.bin), ...targets(manifest.exports)]
        .filter((target) => !files.has(target))
        .map((target) => `${target} is a target but is not packed`);
    const absent = ALLOWED_FILES.filter((file) => !files.has(file)).map(
        (file) => `${file} is not packed`,
    );
    return [...extra, ...missing, ...absent];
}

function run(command: string, args: string[], cwd: string): void {
    execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** `pnpm pack` of the repository into `dir`; returns the tarball's path. */
function pack(dir: string): string {
    const output = execFileSync(
        "pnpm",
        ["pack", "--pack-destination", dir, "--json"],
        { cwd: root, encoding: "utf8" },
    );
    const { filename } = JSON.parse(output) as { filename: string };
    return filename;
}

function packedManifest(tarball: string): Manifest {
    return JSON.parse(
        execFileSync("tar", ["-xOzf", tarball, "package/package.json"], {
            encoding: "utf8",
        }),
    );
}

/** The files of a tarball, as `./path` relative to the package. */
function tarballFiles(tarball: string): Set<string> {
    return new Set(
        execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
            .split("\n")
            .filter((line) => line.startsWith("package/"))
            .map((line) => `./${line.slice("package/".length)}`),
    );
}

/**
 * `fragiola mcp` in `app`: sends `initialize` then `tools/list` (newline-delimited JSON-RPC) and
 * returns the tool names. Fails on anything but JSON-RPC on stdout, or after 30 s.
 */
function listTools(app: string): Promise<string[]> {
    const bin = join(app, "node_modules", ".bin", "fragiola");
    const child = spawn(bin, ["mcp"], {
        cwd: app,
        stdio: ["pipe", "pipe", "inherit"],
    });
    const send = (message: object) =>
        child.stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`,
        );
    let timer: NodeJS.Timeout | undefined;
    return new Promise<string[]>((resolvePromise, reject) => {
        timer = setTimeout(
            () => reject(new Error("fragiola mcp: no answer in 30 s")),
            30_000,
        );
        let buffer = "";
        child.on("error", reject);
        child.on("exit", (code) =>
            reject(new Error(`fragiola mcp exited early (${code})`)),
        );
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            buffer += chunk;
            let newline = buffer.indexOf("\n");
            while (newline !== -1) {
                const line = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf("\n");
                let message: {
                    id?: number;
                    error?: unknown;
                    result?: {
                        serverInfo?: { name?: string };
                        tools?: { name: string }[];
                    };
                };
                try {
                    message = JSON.parse(line);
                } catch {
                    reject(new Error(`fragiola mcp: not JSON-RPC: ${line}`));
                    return;
                }
                if (message.error !== undefined) {
                    reject(
                        new Error(
                            `fragiola mcp: ${JSON.stringify(message.error)}`,
                        ),
                    );
                } else if (message.id === 1) {
                    if (message.result?.serverInfo?.name !== "fragiola") {
                        reject(new Error(`fragiola mcp: ${line}`));
                        return;
                    }
                    send({ method: "notifications/initialized" });
                    send({ id: 2, method: "tools/list" });
                } else if (message.id === 2) {
                    resolvePromise(
                        (message.result?.tools ?? []).map((tool) => tool.name),
                    );
                }
            }
        });
        send({
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2025-11-25",
                capabilities: {},
                clientInfo: {
                    name: "fragiola-check-package",
                    version: "0.0.0",
                },
            },
        });
    }).finally(() => {
        clearTimeout(timer);
        child.removeAllListeners("exit");
        child.kill();
    });
}

/** Installs the tarball in a scratch project outside the repository and runs it. */
async function smoke(tarball: string, manifest: Manifest): Promise<string[]> {
    const app = mkdtempSync(join(tmpdir(), "fragiola-smoke-"));
    try {
        writeFileSync(
            join(app, "package.json"),
            `${JSON.stringify({ name: "smoke", private: true, type: "module" })}\n`,
        );
        run(
            "npm",
            ["install", "--no-audit", "--no-fund", resolve(tarball)],
            app,
        );
        const problems: string[] = [];
        const version = execFileSync(
            join(app, "node_modules", ".bin", "fragiola"),
            ["--version"],
            { cwd: app, encoding: "utf8" },
        ).trim();
        if (version !== manifest.version) {
            problems.push(
                `fragiola --version prints "${version}", not ${manifest.version}`,
            );
        }
        writeFileSync(
            join(app, "imports.mjs"),
            [
                'import { createServer, toolNames } from "fragiola";',
                'import * as mcp from "fragiola/mcp";',
                'if (typeof createServer !== "function" || toolNames.length === 0) throw new Error("fragiola: bad export");',
                'if (Object.keys(mcp).length === 0) throw new Error("fragiola/mcp: no export");',
                "",
            ].join("\n"),
        );
        run("node", ["imports.mjs"], app);
        const tools = await listTools(app);
        if (JSON.stringify(tools) !== JSON.stringify(toolNames)) {
            problems.push(
                `fragiola mcp lists ${tools.join(", ")}, not ${toolNames.join(", ")}`,
            );
        }
        return problems;
    } finally {
        rmSync(app, { recursive: true, force: true });
    }
}

async function main(): Promise<void> {
    const given = tarballsOption(process.argv.slice(2));
    const packs = mkdtempSync(join(tmpdir(), "fragiola-pack-"));
    try {
        let tarball: string;
        if (given === undefined) {
            tarball = pack(packs);
        } else {
            const found = findTarballs(given);
            if (found.length !== 1 || found[0] === undefined) {
                throw new Error(
                    `--tarballs: expected one .tgz file under ${given}, found ${found.length}`,
                );
            }
            tarball = found[0];
        }
        const manifest = packedManifest(tarball);
        console.log(
            `checking ${manifest.name}@${manifest.version} (${tarball})`,
        );
        const problems = fileProblems(manifest, tarballFiles(tarball));
        run("pnpm", ["exec", "publint", tarball, "--strict"], root);
        run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only"], root);
        problems.push(...(await smoke(tarball, manifest)));
        if (problems.length > 0) {
            console.error(problems.map((problem) => `✗ ${problem}`).join("\n"));
            process.exit(1);
        }
        console.log(`✓ ${manifest.name}@${manifest.version} can be published`);
    } finally {
        rmSync(packs, { recursive: true, force: true });
    }
}

if (import.meta.main) await main();
