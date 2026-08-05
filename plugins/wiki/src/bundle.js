/**
 * Loading a bundle once, so every check reads the same picture.
 *
 * Bundle root discovery walks upward looking for the `index.md` that carries
 * `okf_version`, which is what makes the tool independent of any one project's
 * directory name.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
export const RESERVED = new Set(["index.md", "log.md"]);
// Directories whose contents are not concepts. Declared by the ruleset's
// check-scope rule: an intake queue, a source-document store, and the place a
// project's methodology keeps its concept templates - stamps with placeholder
// frontmatter, not concepts.
export const EXCLUDED = ["inbox/", "raw/", "conventions/templates/"];
const FM = /^---\n([\s\S]*?)\n---\n/;
const LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+?)(#[^)]*)?\)/g;
const FENCE = /^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm;
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//;
/** The tool cannot proceed. Says nothing about whether the bundle is valid. */
export class BundleError extends Error {
    constructor(message) {
        super(message);
        this.name = "BundleError";
    }
}
/**
 * Absolute path with symlinks resolved as far as the path exists, the rest
 * appended - `Path.resolve()` in Python, which does not require existence.
 */
export function resolvePath(p) {
    const abs = path.resolve(p);
    const tail = [];
    let cur = abs;
    for (;;) {
        try {
            return path.join(fs.realpathSync(cur), ...tail);
        }
        catch {
            const parent = path.dirname(cur);
            if (parent === cur)
                return abs;
            tail.unshift(path.basename(cur));
            cur = parent;
        }
    }
}
/**
 * Order two paths the way pathlib orders Path objects: segment by segment, so
 * a directory sorts before its own children and beside its siblings.
 */
export function comparePaths(a, b) {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
        if (pa[i] !== pb[i])
            return pa[i] < pb[i] ? -1 : 1;
    }
    return pa.length - pb.length;
}
/**
 * Every `*.md` under `dir`, recursively, sorted. Directory symlinks are not
 * followed (pathlib's `rglob` does not follow them either).
 */
export function markdownUnder(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            const full = path.join(cur, entry.name);
            if (entry.isDirectory())
                stack.push(full);
            else if (entry.name.endsWith(".md"))
                out.push(full);
        }
    }
    return out.sort(comparePaths);
}
export function hasMarkdownUnder(dir) {
    return markdownUnder(dir).length > 0;
}
/** Every file under `dir`, recursively, sorted. Extension is not consulted. */
export function filesUnder(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...filesUnder(full));
        else
            out.push(full);
    }
    return out.sort(comparePaths);
}
export function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Python's `str.partition`: everything before the separator, the separator,
 * everything after - and the whole string with two empties when it is absent.
 */
function partition(s, sep) {
    const i = s.indexOf(sep);
    if (i === -1)
        return [s, "", ""];
    return [s.slice(0, i), sep, s.slice(i + sep.length)];
}
function stripQuotes(s) {
    let a = 0;
    let b = s.length;
    while (a < b && s[a] === '"')
        a += 1;
    while (b > a && s[b - 1] === '"')
        b -= 1;
    return s.slice(a, b);
}
function head(p, n = 400) {
    try {
        return fs.readFileSync(p, "utf8").slice(0, n);
    }
    catch {
        return "";
    }
}
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
/** Walk upward for a directory holding an index.md with `okf_version`. */
export function findRoot(start) {
    const from = resolvePath(start);
    for (const base of [from, ...ancestors(from)]) {
        const dirs = fs
            .readdirSync(base, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(base, e.name))
            .sort(comparePaths);
        for (const cand of [...dirs, base]) {
            const idx = path.join(cand, "index.md");
            if (isFile(idx) && head(idx).includes("okf_version"))
                return cand;
        }
    }
    throw new BundleError(`no bundle root at or above ${from} ` +
        "(looking for an index.md carrying okf_version)");
}
/** Every ancestor of `p`, nearest first - pathlib's `Path.parents`. */
export function ancestors(p) {
    const out = [];
    let cur = path.resolve(p);
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur)
            break;
        out.push(parent);
        cur = parent;
    }
    return out;
}
/**
 * Shallow frontmatter parse.
 *
 * Deliberately not a YAML load: the checks need `type`, `status`, and the
 * `sources` entries, and a shallow reader keeps line numbers, which a YAML
 * load throws away. `end` is where the block ends, so callers can point at it.
 */
export function parseFrontmatter(text) {
    const m = FM.exec(text);
    if (!m)
        return { meta: {}, end: 0 };
    const block = m[1];
    const data = {};
    const sources = [];
    let cur = null;
    const lines = block.split("\n");
    lines.forEach((line, index) => {
        let raw = line;
        const i = index + 2;
        if (raw.startsWith("  - ")) {
            cur = { line: i };
            sources.push(cur);
            raw = "    " + raw.slice(4);
        }
        if (raw.startsWith("    ") && cur !== null) {
            const [k, , v] = partition(raw.trim(), ":");
            if (k)
                cur[k.trim()] = stripQuotes(v.trim());
            return;
        }
        if (raw && !raw.startsWith(" ")) {
            const [k, , v] = partition(raw, ":");
            const key = k.trim();
            if (key === "sources") {
                cur = null;
                return;
            }
            data[key] = stripQuotes(v.trim());
            cur = null;
        }
    });
    if (sources.length)
        data.sources = sources;
    return { meta: data, end: lines.length + 2 };
}
export class Doc {
    path;
    rel;
    text;
    meta;
    constructor({ path: p, rel, text, meta = {}, }) {
        this.path = p;
        this.rel = rel;
        this.text = text;
        this.meta = meta;
    }
    get name() {
        return path.basename(this.path);
    }
    get isReserved() {
        return RESERVED.has(this.name);
    }
    get excluded() {
        return EXCLUDED.some((prefix) => this.rel.startsWith(prefix));
    }
    get type() {
        return this.meta.type;
    }
    get sources() {
        return this.meta.sources ?? [];
    }
    /** (target, line) for every markdown link in the body, fenced code excluded. */
    links() {
        const text = this.text.replace(FENCE, (block) => "\n".repeat(countNewlines(block)));
        const out = [];
        for (const m of text.matchAll(LINK)) {
            const line = countNewlines(text.slice(0, m.index ?? 0)) + 1;
            out.push({ target: m[1], line });
        }
        return out;
    }
}
function countNewlines(s) {
    let n = 0;
    for (let i = 0; i < s.length; i += 1)
        if (s[i] === "\n")
            n += 1;
    return n;
}
export class Bundle {
    root;
    docs;
    constructor(root, docs) {
        this.root = root;
        this.docs = docs;
    }
    static load(root) {
        const docs = [];
        for (const p of markdownUnder(root)) {
            let text;
            try {
                text = fs.readFileSync(p, "utf8");
            }
            catch (e) {
                throw new BundleError(`cannot read ${p}: ${message(e)}`);
            }
            const rel = path.relative(root, p).split(path.sep).join("/");
            const { meta } = parseFrontmatter(text);
            docs.push(new Doc({ path: p, rel, text, meta }));
        }
        return new Bundle(root, docs);
    }
    /** Everything the rules apply to: not reserved, not in an excluded place. */
    get concepts() {
        return this.docs.filter((d) => !d.isReserved && !d.excluded);
    }
    /** Concepts plus the indexes and logs that the rules also govern. */
    get checked() {
        return this.docs.filter((d) => !d.excluded);
    }
    /** Resolve a link target. Bundle-absolute when it starts with a slash. */
    resolve(fromDoc, target) {
        if (SCHEME.test(target) || target.startsWith("mailto:"))
            return null;
        const base = target.startsWith("/") ? this.root : path.dirname(fromDoc.path);
        return resolvePath(path.join(base, target.replace(/^\/+/, "")));
    }
    blobSha(target) {
        const out = spawnSync("git", ["hash-object", target], { encoding: "utf8" });
        if (out.error || out.status !== 0 || typeof out.stdout !== "string")
            return null;
        return out.stdout.trim() || null;
    }
}
export function message(e) {
    return e instanceof Error ? e.message : String(e);
}
