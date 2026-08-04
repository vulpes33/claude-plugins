/**
 * `vwiki init` - lay down an OKF bundle skeleton (scenario S0).
 *
 * The skeleton is a template directory shipped beside the tool, copied
 * verbatim. Nothing here is generated, which is the point: `template/` is the
 * fixed point of the index generator for an empty bundle, so a fresh copy
 * validates clean with no diff, and the one place to change the skeleton is a
 * file a human can read. The tool writes no prose (P7); the adoption record is
 * not written at all - adopting a ruleset is a deliberate act, and the skill
 * that performs it writes `conventions/ruleset.md` itself.
 *
 * `raw/` and `inbox/` are made empty. Git cannot carry an empty directory, so
 * they cannot come from the template; they reach git with their first file.
 *
 * Refusals, all judged before anything is written (P5):
 * - the target sits inside an existing bundle (its own ancestor chain only -
 *   siblings of ancestors are none of init's business);
 * - an ancestor carries an index.md init cannot read - a bundle the tool cannot
 *   even check is not one it may quietly nest inside;
 * - the target exists and is not an empty directory.
 *
 * Failure after writing rolls back: init records every path it creates and
 * removes them deepest-first; the rollback is idempotent and re-runnable, and
 * when it cannot finish it names what is left.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ancestors, BundleError, comparePaths, message, resolvePath } from "./bundle.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(HERE, "..", "template");
/** Directories a bundle owns that no template can carry, being empty. */
export const EMPTY_PLACES = ["raw", "inbox"];
function exists(p) {
    try {
        fs.lstatSync(p);
        return true;
    }
    catch {
        return false;
    }
}
function bundleRootAt(p) {
    const idx = path.join(p, "index.md");
    try {
        if (!fs.statSync(idx).isFile())
            return false;
    }
    catch {
        return false;
    }
    let head;
    try {
        head = fs.readFileSync(idx, "utf8").slice(0, 400);
    }
    catch (e) {
        throw new BundleError(`cannot read ${idx}: ${message(e)} - refusing to init under an unreadable bundle root`);
    }
    return head.includes("okf_version");
}
/** Every path under `dir`, relative and posix-separated, parents before children. */
function inventory(dir) {
    const dirs = [];
    const files = [];
    const walk = (cur, prefix) => {
        const entries = fs
            .readdirSync(cur, { withFileTypes: true })
            .sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                dirs.push(rel);
                walk(path.join(cur, entry.name), rel);
            }
            else {
                files.push(rel);
            }
        }
    };
    walk(dir, "");
    return { dirs, files };
}
function remove(p) {
    const st = fs.lstatSync(p);
    if (st.isDirectory())
        fs.rmdirSync(p);
    else
        fs.unlinkSync(p);
}
function rollback(created) {
    const leftovers = [];
    const deepestFirst = [...new Set(created)].sort((a, b) => b.split(path.sep).length - a.split(path.sep).length || comparePaths(b, a));
    for (const p of deepestFirst) {
        try {
            if (exists(p))
                remove(p);
        }
        catch {
            leftovers.push(p);
        }
    }
    return leftovers;
}
export function initBundle(target, options = {}) {
    const template = options.template ?? TEMPLATE;
    const out = options.out ?? ((line) => console.log(line));
    const dest = resolvePath(target || ".wiki");
    for (const p of [dest, ...ancestors(dest)]) {
        if (!exists(p) || !bundleRootAt(p))
            continue;
        throw new BundleError(p === dest
            ? `${dest} is already a bundle - init refuses to touch it`
            : `${dest} is inside an existing bundle rooted at ${p}`);
    }
    if (exists(dest)) {
        if (!fs.statSync(dest).isDirectory()) {
            throw new BundleError(`${dest} exists and is not a directory`);
        }
        try {
            if (fs.readdirSync(dest).length) {
                throw new BundleError(`${dest} exists and is not empty - init refuses to touch it`);
            }
        }
        catch (e) {
            if (e instanceof BundleError)
                throw e;
            throw new BundleError(`cannot inspect ${dest}: ${message(e)}`);
        }
    }
    if (!exists(template)) {
        throw new BundleError(`packaged bundle template missing at ${template}`);
    }
    const { dirs, files } = inventory(template);
    // P9: say what will be written, then write it.
    out(`creating bundle at ${dest}:`);
    for (const rel of [...files].sort())
        out(`  ${rel}`);
    for (const rel of EMPTY_PLACES)
        out(`  ${rel}/`);
    const created = [];
    try {
        if (!exists(dest)) {
            // Making the target may make ancestors too - record them all so the
            // rollback can take every one back.
            const toMake = [dest, ...ancestors(dest)].filter((q) => !exists(q));
            fs.mkdirSync(dest, { recursive: true });
            created.push(...toMake);
        }
        for (const rel of dirs) {
            const d = path.join(dest, rel);
            fs.mkdirSync(d);
            created.push(d);
        }
        for (const rel of EMPTY_PLACES) {
            const d = path.join(dest, rel);
            fs.mkdirSync(d);
            created.push(d);
        }
        for (const rel of files) {
            const f = path.join(dest, rel);
            fs.copyFileSync(path.join(template, rel), f);
            created.push(f);
        }
    }
    catch (e) {
        // Roll back first, re-raise after - a failure must not leave a half-made
        // bundle behind (the same bar P1 sets for index restore).
        const leftovers = rollback(created);
        let msg = `init failed and was rolled back: ${message(e)}`;
        if (leftovers.length)
            msg += "; could not remove: " + leftovers.join(", ");
        throw new BundleError(msg);
    }
    out("next:");
    out("  - record the ruleset this bundle adopts in conventions/ruleset.md (the wiki skill writes it)");
    out("  - declare the project language and writing rules in conventions/project.md" +
        " (English is assumed otherwise)");
    out("  - after edits: `vwiki validate --fix`, then `vwiki validate`");
    out("note: raw/ and inbox/ reach git (and the root index) with their first file");
    return 0;
}
