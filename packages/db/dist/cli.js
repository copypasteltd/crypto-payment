function printJson(stdout, value) {
    stdout.log(JSON.stringify(value, null, 2));
}
function printUsage(stdout, options) {
    stdout.log([
        `Usage: ${options.programName} <up|status|dry-run|reset|seed|help> [--confirm-reset]`,
        "",
        "Commands:",
        "  up         Apply pending migrations",
        "  status     Print current migration status",
        "  dry-run    Print migration plan without applying changes",
        "  reset      Reset the configured database schema (requires --confirm-reset)",
        "  seed       Seed reference data through application hooks",
    ].join("\n"));
}
function parseCommand(argv) {
    const [command = "up", ...rest] = argv;
    const flags = new Set(rest);
    return {
        command,
        flags,
    };
}
export async function runPostgresDatabaseCli(options, argv = process.argv.slice(2)) {
    const stdout = options.stdout ?? console;
    const parsed = parseCommand(argv);
    switch (parsed.command) {
        case "up":
            printJson(stdout, await options.manager.runMigrations());
            return;
        case "status":
            printJson(stdout, await options.manager.getMigrationStatus());
            return;
        case "dry-run":
            printJson(stdout, await options.manager.runMigrations({ dryRun: true }));
            return;
        case "reset":
            if (!options.reset) {
                throw new Error("Database reset is not supported by this CLI target.");
            }
            if (!parsed.flags.has("--confirm-reset")) {
                throw new Error("Database reset requires --confirm-reset.");
            }
            printJson(stdout, await options.reset());
            return;
        case "seed":
            if (!options.seed) {
                throw new Error("Database seed is not supported by this CLI target.");
            }
            printJson(stdout, await options.seed());
            return;
        case "-h":
        case "--help":
        case "help":
            printUsage(stdout, options);
            return;
        default:
            printUsage(stdout, options);
            throw new Error(`Unknown database command: ${parsed.command}`);
    }
}
//# sourceMappingURL=cli.js.map