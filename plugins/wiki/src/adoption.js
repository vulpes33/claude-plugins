/**
 * The ruleset version gate (design policy P8).
 *
 * A bundle declares the ruleset it follows in `conventions/ruleset.md`, as a
 * frontmatter extension key: `ruleset: { name: <name>, version: X.Y.Z }`.
 * This tool ships exactly one ruleset, named in `ruleset/manifest.yaml` beside
 * the package. Checking a bundle against rules the tool does not implement
 * would silently apply the wrong rules, so that case refuses instead:
 *
 * - adopted name differs from the shipped ruleset  -> refuse (BundleError)
 * - adopted version newer than shipped             -> refuse (BundleError)
 * - adopted version older than shipped             -> WARN: the bundle lags
 * - no adoption record                             -> no gate; not every bundle
 *                                                     follows a ruleset (the
 *                                                     ruleset bundle itself,
 *                                                     test fixtures)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BundleError } from "./bundle.js";
import { finding, WARN } from "./finding.js";
export const CHECK = "adoption";
export const RECORD = "conventions/ruleset.md";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST = path.join(HERE, "..", "ruleset", "manifest.yaml");
let manifestPath = DEFAULT_MANIFEST;
export function manifest() {
    return manifestPath;
}
/** The packaged manifest the gate reads; a test may point it elsewhere. */
export function setManifest(p) {
    manifestPath = p;
}
const FLOW = /name:\s*([\w.-]+)\s*,\s*version:\s*([\w.-]+)/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
/**
 * Top-level scalar keys of the packaged manifest, quotes stripped.
 *
 * The one parser for that file: `okf_version: "0.2"` and `version: 0.2.1`
 * must read the same way, or two readers drift into two truths.
 */
function read() {
    let raw;
    try {
        if (!fs.statSync(manifestPath).isFile())
            throw new Error("not a file");
        raw = fs.readFileSync(manifestPath, "utf8");
    }
    catch {
        throw new BundleError(`packaged ruleset manifest missing at ${manifestPath}`);
    }
    const data = {};
    for (const line of raw.split("\n")) {
        if (!line || line.startsWith("#") || line.startsWith(" ") || line.startsWith("\t")) {
            continue;
        }
        const i = line.indexOf(":");
        if (i === -1)
            continue;
        data[line.slice(0, i).trim()] = line
            .slice(i + 1)
            .trim()
            .replace(/^"+|"+$/g, "");
    }
    return data;
}
export function okfVersion() {
    const v = read().okf_version;
    if (!v) {
        throw new BundleError(`packaged ruleset manifest carries no okf_version at ${manifestPath}`);
    }
    return v;
}
export function shipped() {
    const data = read();
    const parsed = VERSION.exec(data.version ?? "");
    if (!data.name || !parsed) {
        throw new BundleError(`packaged ruleset manifest unreadable at ${manifestPath}`);
    }
    return {
        name: data.name,
        version: [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])],
    };
}
function cmp(a, b) {
    for (let i = 0; i < 3; i += 1)
        if (a[i] !== b[i])
            return a[i] - b[i];
    return 0;
}
export function gate(bundle) {
    const record = bundle.docs.find((d) => d.rel === RECORD);
    const declared = record ? record.meta.ruleset ?? "" : "";
    if (!record || !declared)
        return [];
    const m = FLOW.exec(String(declared));
    if (!m) {
        return [
            finding({
                level: WARN,
                check: CHECK,
                path: record.rel,
                message: `adoption record unreadable: ruleset: ${quote(String(declared))}`,
            }),
        ];
    }
    const [, name, raw] = m;
    const parsed = VERSION.exec(raw);
    if (!parsed) {
        return [
            finding({
                level: WARN,
                check: CHECK,
                path: record.rel,
                message: `adoption record version unreadable: ${quote(raw)}`,
            }),
        ];
    }
    const adopted = [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
    const { name: shippedName, version } = shipped();
    const shippedStr = version.join(".");
    if (name !== shippedName) {
        throw new BundleError(`bundle follows ruleset ${quote(name)}; this tool implements ` +
            `${quote(shippedName)} and cannot check against rules it does not carry`);
    }
    if (cmp(adopted, version) > 0) {
        throw new BundleError(`bundle follows ${name} ${raw}; this tool implements ` +
            `${shippedStr} and refuses to check against a newer ruleset than it carries`);
    }
    if (cmp(adopted, version) < 0) {
        return [
            finding({
                level: WARN,
                check: CHECK,
                path: record.rel,
                message: `bundle adopts ${name} ${raw}, the packaged ruleset is ${shippedStr} - ` +
                    "bring the bundle into line, then update the adoption record",
            }),
        ];
    }
    return [];
}
/** Python's `!r` for the strings this module quotes. */
function quote(s) {
    return s.includes("'") && !s.includes('"') ? `"${s}"` : `'${s.replace(/'/g, "\\'")}'`;
}
