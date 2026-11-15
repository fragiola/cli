#!/usr/bin/env node
import { log } from "./lib/log.ts";
import { createProgram } from "./program.ts";

createProgram()
    .parseAsync(process.argv)
    .catch((error: unknown) => {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
