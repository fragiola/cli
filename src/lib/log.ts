/**
 * Every message of the CLI goes to stderr: stdout carries the MCP protocol when
 * `fragiola mcp` runs, and a stray line there breaks the client's connection.
 */
export const log = {
    info(message: string): void {
        process.stderr.write(`${message}\n`);
    },
    error(message: string): void {
        process.stderr.write(`${message}\n`);
    },
};
