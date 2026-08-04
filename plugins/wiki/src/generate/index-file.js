/**
 * Generating an `index.md` from what the directory actually holds.
 *
 * The rules are in the bundle's reserved-files convention. They are written to be
 * decidable without judgment, which is what lets this be code: sections are
 * derived from types, order is the file name, and an entry's description is the
 * target's own `description` copied verbatim.
 */
import fs from "node:fs";
import path from "node:path";
import { okfVersion } from "../adoption.js";
import { comparePaths, Doc, hasMarkdownUnder, markdownUnder, parseFrontmatter, RESERVED, } from "../bundle.js";
const PLACEHOLDER = /^<.*>$/;
/** The target's own description, or its type when there is nothing usable. */
function describe(doc) {
    const desc = String(doc.meta.description ?? "").trim();
    if (desc && !PLACEHOLDER.test(desc))
        return desc;
    return doc.type || "";
}
/**
 * Every directory holding concepts, minus the ones the rules exclude.
 *
 * `raw/` gets no index at any level: an original may itself be named
 * `index.md`, so a generator writing there would overwrite what the directory
 * exists to keep. `inbox/` is a queue, not a graph. `conventions/templates/`
 * holds the methodology's stamps, and an index in an excluded place is not
 * generated (the reserved-files rules).
 */
export function directoriesNeedingIndex(bundle) {
    const parents = new Set(markdownUnder(bundle.root).map((p) => path.dirname(p)));
    const dirs = [];
    for (const d of [...parents].sort(comparePaths)) {
        const raw = path.relative(bundle.root, d).split(path.sep).join("/");
        const rel = raw === "." ? "" : raw;
        if (rel.startsWith("raw") || rel.startsWith("inbox"))
            continue;
        if (rel === "conventions/templates" || rel.startsWith("conventions/templates/")) {
            continue;
        }
        dirs.push(d);
    }
    return dirs;
}
export function render(bundle, directory) {
    const relDir = path.relative(bundle.root, directory);
    const byType = new Map();
    const subdirs = [];
    const children = fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));
    for (const child of children) {
        const full = path.join(directory, child.name);
        if (child.isDirectory()) {
            // The queue is volatile until the flush; listing it would go stale on
            // every drop and every flush, so no generated index ever names it.
            if (relDir === "" && child.name === "inbox")
                continue;
            if (hasMarkdownUnder(full))
                subdirs.push(child.name);
            continue;
        }
        if (path.extname(child.name) !== ".md" || RESERVED.has(child.name))
            continue;
        const { meta } = parseFrontmatter(fs.readFileSync(full, "utf8"));
        const doc = new Doc({
            path: full,
            rel: path.relative(bundle.root, full),
            text: "",
            meta,
        });
        const key = doc.type || "Untyped";
        const entries = byType.get(key) ?? [];
        entries.push([child.name, describe(doc)]);
        byType.set(key, entries);
    }
    const out = [];
    if (subdirs.length) {
        out.push("# Subdirectories");
        out.push("");
        for (const name of subdirs)
            out.push(`* [${name}/](${name}/)`);
        out.push("");
    }
    for (const typeName of [...byType.keys()].sort()) {
        // The heading is the type verbatim. Pluralizing it was tried and broke
        // on names that are already plural ("Business Requirements"), and any
        // rule good enough for English is one more thing to port.
        out.push(`# ${typeName}`);
        out.push("");
        const entries = byType.get(typeName);
        for (const [name, desc] of [...entries].sort(compareEntries)) {
            out.push(`* [${name}](${name})` + (desc ? ` - ${desc}` : ""));
        }
        out.push("");
    }
    const lines = out.length ? out : ["# Concepts", ""];
    // An empty directory keeps a section and says nothing about being empty.
    const body = lines.join("\n").replace(/\s+$/, "") + "\n";
    if (relDir === "" || relDir === ".") {
        // The packaged manifest is the one source of the version this ruleset
        // targets; a second hardcoded copy here silently downgraded seeds.
        return `---\nokf_version: "${okfVersion()}"\n---\n\n` + body;
    }
    return body;
}
function compareEntries(a, b) {
    if (a[0] !== b[0])
        return a[0] < b[0] ? -1 : 1;
    if (a[1] !== b[1])
        return a[1] < b[1] ? -1 : 1;
    return 0;
}
export function write(bundle, directory) {
    const target = path.join(directory, "index.md");
    const next = render(bundle, directory);
    const old = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (old === next)
        return false;
    fs.writeFileSync(target, next, "utf8");
    return true;
}
