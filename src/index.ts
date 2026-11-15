/**
 * The programmatic API of the `fragiola` package. The binary lives in `cli.ts`;
 * importing this module never runs a command.
 */
export { createServer, instructions, toolNames } from "./mcp/index.ts";
export { createProgram } from "./program.ts";
