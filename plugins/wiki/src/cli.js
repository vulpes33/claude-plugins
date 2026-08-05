/**
 * vwiki — the command surface.
 *
 * Exit codes are the contract with CI and with an agent:
 * 0 nothing to report, 1 the bundle breaks a rule, 2 the tool could not run and
 * says nothing about the bundle. Keeping 2 out of 1 is what stops a broken tool
 * from being read as a broken bundle.
 */
import path from "node:path";
import { gate } from "./adoption.js";
import { Bundle, BundleError, comparePaths, findRoot } from "./bundle.js";
import * as conformance from "./checks/conformance.js";
import * as hashes from "./checks/hashes.js";
import * as inbox from "./checks/inbox.js";
import * as indexDiff from "./checks/index-diff.js";
import * as links from "./checks/links.js";
import { ERROR, render } from "./finding.js";
import * as indexFile from "./generate/index-file.js";
import { initBundle } from "./init.js";
export const OK = 0;
export const FINDINGS = 1;
export const TOOL_ERROR = 2;
export const CHECKS = {
    conformance: conformance.run,
    links: links.run,
    hashes: hashes.run,
    index: indexDiff.run,
    inbox: inbox.run,
};
export const USAGE = `usage: vwiki <command> [<args>]

commands:
  init [<dir>]                          copy the bundle skeleton into <dir> (default: .wiki)
  validate [<bundle>] [--fix] [--json]  report rule violations

options:
  --fix     repin hashes and regenerate indexes before checking
  --json    print findings as JSON
  -h, --help

exit codes: 0 nothing to report, 1 the bundle breaks a rule, 2 the tool could not run`;
class UsageError extends Error {
}
function load(p) {
    return Bundle.load(findRoot(p || process.cwd()));
}
/** How many times index generation may feed itself before it is a cycle. */
export const MAX_PASSES = 10;
/** Repin and regenerate indexes to a fixed point; returns what was written. */
export function applyFix(bundle) {
    const written = new Set(hashes.repin(bundle));
    let current = Bundle.load(bundle.root);
    // One generated index can be the first markdown in its directory, which is
    // what makes the index above it name that directory. A single pass would
    // leave behind the drift it had just created - a store indexed for the first
    // time, and a root index that still does not know the store is there. Iterate
    // to a fixed point, the same bar repinning holds itself to.
    let converged = false;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        let changed = false;
        for (const directory of indexFile.directoriesNeedingIndex(current)) {
            if (indexFile.write(current, directory)) {
                written.add(path.join(directory, "index.md"));
                changed = true;
            }
        }
        current = Bundle.load(current.root);
        if (!changed) {
            converged = true;
            break;
        }
    }
    if (!converged) {
        throw new Error(`index generation did not converge in ${MAX_PASSES} passes; ` +
            "an index that changes another index that changes it back is the usual cause");
    }
    if (written.size) {
        // Writing an index changes a blob that something may pin.
        for (const p of hashes.repin(current))
            written.add(p);
        current = Bundle.load(current.root);
    }
    return { bundle: current, written: [...written].sort(comparePaths) };
}
function cmdValidate(args, io) {
    let bundle = load(args.path);
    // The version gate runs before anything writes. Refusing a bundle after
    // repinning half of it would leave it modified by a tool that then claims
    // to know nothing about it.
    const findings = [...gate(bundle)];
    if (args.fix) {
        const fixed = applyFix(bundle);
        bundle = fixed.bundle;
        for (const p of fixed.written) {
            io.out(path.relative(bundle.root, p).split(path.sep).join("/"));
        }
    }
    for (const name of Object.keys(CHECKS))
        findings.push(...CHECKS[name](bundle));
    const out = render(findings, args.json);
    if (out)
        io.out(out);
    return findings.some((f) => f.level === ERROR) ? FINDINGS : OK;
}
export function parseArgs(argv) {
    if (!argv.length)
        throw new UsageError("a command is required");
    if (argv[0] === "-h" || argv[0] === "--help") {
        return { cmd: "help", path: null, fix: false, json: false };
    }
    const cmd = argv[0];
    if (cmd !== "init" && cmd !== "validate") {
        throw new UsageError(`unknown command: ${cmd}`);
    }
    let target = null;
    let fix = false;
    let json = false;
    for (const arg of argv.slice(1)) {
        if (arg === "-h" || arg === "--help") {
            return { cmd: "help", path: null, fix: false, json: false };
        }
        if (arg === "--fix" || arg === "--json") {
            if (cmd !== "validate")
                throw new UsageError(`${cmd} takes no ${arg}`);
            if (arg === "--fix")
                fix = true;
            else
                json = true;
            continue;
        }
        if (arg.startsWith("-") && arg !== "-")
            throw new UsageError(`unknown option: ${arg}`);
        if (target !== null)
            throw new UsageError(`unexpected argument: ${arg}`);
        target = arg;
    }
    return { cmd, path: target, fix, json };
}
export function main(argv = [], io = {}) {
    const out = io.out ?? ((line) => console.log(line));
    const err = io.err ?? ((line) => console.error(line));
    let args;
    try {
        args = parseArgs(argv);
    }
    catch (e) {
        err(USAGE);
        err(`vwiki: ${e instanceof Error ? e.message : String(e)}`);
        return TOOL_ERROR;
    }
    try {
        if (args.cmd === "help") {
            out(USAGE);
            return OK;
        }
        if (args.cmd === "init")
            return initBundle(args.path, { out });
        return cmdValidate(args, { out });
    }
    catch (e) {
        if (e instanceof BundleError) {
            err(`vwiki: ${e.message}`);
            return TOOL_ERROR;
        }
        // A crash says nothing about the bundle. Exiting 1 here would read as
        // "the bundle breaks a rule" and send someone off to fix it.
        err(e instanceof Error && e.stack ? e.stack : String(e));
        return TOOL_ERROR;
    }
}
