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
import { comparePaths, Doc, filesUnder, hasMarkdownUnder, isDirectory, markdownUnder, parseFrontmatter, RESERVED, } from "../bundle.js";
const PLACEHOLDER = /^<.*>$/;
/** The store. Its index is generated from the files, not from concepts. */
export const STORE = "raw";
const RECORD = "Record";
const UNCITED = "cited by no concept";
/** The target's own description, or its type when there is nothing usable. */
function describe(doc) {
    const desc = String(doc.meta.description ?? "").trim();
    if (desc && !PLACEHOLDER.test(desc))
        return desc;
    return doc.type || "";
}
/**
 * Every directory holding concepts, plus the store, minus the ones the rules
 * exclude.
 *
 * The store's root gets an index of what it holds - a store nobody can read
 * without listing the directory is a store nobody reads. Below that root it
 * gets none: one index names every original at every depth, and a second one
 * deeper down would say the same thing twice. `inbox/` is a queue, not a
 * graph. `conventions/templates/` holds the methodology's stamps, and an index
 * in an excluded place is not generated (the reserved-files rules).
 */
export function directoriesNeedingIndex(bundle) {
    const parents = new Set(markdownUnder(bundle.root).map((p) => path.dirname(p)));
    // The store is indexed for holding files, not for holding markdown: a store
    // of nothing but PDFs still needs its index, and an empty one still gets it.
    const store = path.join(bundle.root, STORE);
    if (isDirectory(store))
        parents.add(store);
    const dirs = [];
    for (const d of [...parents].sort(comparePaths)) {
        const raw = path.relative(bundle.root, d).split(path.sep).join("/");
        const rel = raw === "." ? "" : raw;
        if (rel === "inbox" || rel.startsWith("inbox/"))
            continue;
        if (rel.startsWith(`${STORE}/`))
            continue;
        if (rel === "conventions/templates" || rel.startsWith("conventions/templates/")) {
            continue;
        }
        dirs.push(d);
    }
    return dirs;
}
/**
 * The store's index: what is kept, one line per file, paths relative to the
 * store root so the listing survives regrouping into subdirectories.
 *
 * A stored file cannot describe itself - it is somebody else's document, kept
 * byte for byte - so it is named by the citing `sources` entry, which is the
 * one place a work's own title is written. Saying `cited by no concept` where
 * none does is the point: an original nothing cites is provenance nobody
 * claimed, and the listing is where that shows.
 */
function renderStore(bundle, directory) {
    const records = [];
    const files = [];
    for (const full of filesUnder(directory)) {
        const rel = path.relative(directory, full).split(path.sep).join("/");
        // The generated index is not one of the stored files.
        if (rel === "index.md")
            continue;
        if (rel.endsWith(".md")) {
            const { meta } = parseFrontmatter(fs.readFileSync(full, "utf8"));
            if (meta.type === RECORD) {
                records.push([rel, describe(new Doc({ path: full, rel, text: "", meta }))]);
                continue;
            }
        }
        files.push([rel, citedDescription(bundle, rel)]);
    }
    const out = [];
    for (const [heading, entries] of [
        ["Records", records],
        ["Files", files],
    ]) {
        // Both sections stand whether or not they hold anything: a store with no
        // records says so by showing an empty section, not by dropping it.
        if (out.length)
            out.push("");
        out.push(`# ${heading}`);
        if (!entries.length)
            continue;
        out.push("");
        for (const [rel, desc] of [...entries].sort(compareEntries)) {
            out.push(`* [${rel}](${rel})` + (desc ? ` - ${desc}` : ""));
        }
    }
    return out.join("\n").replace(/\s+$/, "") + "\n";
}
/**
 * What the first `sources` entry citing this stored file calls it.
 *
 * The entry's `title` names the work itself, which is what a listing of
 * originals is for: the licence of a spec and the spec are two works, and one
 * concept's `description` cannot say both. That description is the fallback,
 * for an entry written without a title.
 */
function citedDescription(bundle, rel) {
    const resource = `/${STORE}/${rel}`;
    for (const doc of bundle.concepts) {
        const entry = doc.sources.find((e) => e.resource === resource);
        if (!entry)
            continue;
        const title = String(entry.title ?? "").trim();
        return title || String(doc.meta.description ?? "").trim();
    }
    return UNCITED;
}
export function render(bundle, directory) {
    const relDir = path.relative(bundle.root, directory);
    if (relDir === STORE)
        return renderStore(bundle, directory);
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
