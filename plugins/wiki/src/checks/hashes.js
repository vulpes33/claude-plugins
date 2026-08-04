/**
 * `source_blob_sha` pins against the file each `resource` names.
 *
 * Repinning is where this bundle broke three times by hand, always the same way:
 * rewriting a pin changes the pinning file's own blob, so anything pinned to *it*
 * goes stale in the same pass. Iterating to a fixed point is the whole fix, and
 * the iteration is bounded because each pass either changes something or stops.
 */
import fs from "node:fs";
import path from "node:path";
import { Bundle, comparePaths } from "../bundle.js";
import { ERROR, finding } from "../finding.js";
export const CHECK = "hashes";
export const MAX_PASSES = 10;
/** (entry, target path, recorded sha) for every in-bundle pin. */
function pinned(bundle, doc) {
    const out = [];
    for (const entry of doc.sources) {
        const res = entry.resource ?? "";
        const sha = entry.source_blob_sha;
        if (!sha || !res.startsWith("/"))
            continue;
        const target = path.join(bundle.root, res.replace(/^\/+/, ""));
        if (fs.existsSync(target))
            out.push({ entry, target, sha });
    }
    return out;
}
export function run(bundle) {
    const findings = [];
    for (const doc of bundle.checked) {
        if (doc.excluded)
            continue;
        for (const entry of doc.sources) {
            const res = entry.resource ?? "";
            if (!res.startsWith("/"))
                continue;
            // Authoring rule 4: an in-bundle source is pinned or it is wrong.
            // A dead resource or a missing hash silently escapes the staleness
            // judgment, which is the one thing this bundle exists to make.
            const target = path.join(bundle.root, res.replace(/^\/+/, ""));
            const recorded = entry.source_blob_sha;
            const id = entry.id ?? "?";
            const line = typeof entry.line === "number" ? entry.line : null;
            if (!fs.existsSync(target)) {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    line,
                    message: `sources[${id}] cites ${res}, which does not exist`,
                }));
                continue;
            }
            if (!recorded) {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    line,
                    message: `sources[${id}] cites ${res} without source_blob_sha`,
                }));
                continue;
            }
            const actual = bundle.blobSha(target);
            if (actual === null) {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    line,
                    message: `cannot hash ${res}`,
                }));
            }
            else if (actual !== recorded) {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    line,
                    message: `sources[${id}] pins ${recorded.slice(0, 7)}, ` +
                        `${res} is ${actual.slice(0, 7)}`,
                }));
            }
        }
    }
    return findings;
}
/**
 * Rewrite every stale pin, iterating until nothing changes.
 *
 * Returns the paths written, de-duplicated across passes.
 */
export function repin(bundle) {
    const written = new Set();
    let converged = false;
    let current = bundle;
    for (let i = 0; i < MAX_PASSES; i += 1) {
        const changed = onePass(current);
        if (!changed.size) {
            converged = true;
            break;
        }
        for (const p of changed)
            written.add(p);
        current = Bundle.load(current.root);
    }
    if (!converged) {
        throw new Error(`repin did not converge in ${MAX_PASSES} passes; ` +
            "a sources cycle is the usual cause");
    }
    return [...written].sort(comparePaths);
}
function onePass(bundle) {
    const changed = new Set();
    for (const doc of bundle.checked) {
        if (doc.excluded)
            continue;
        const lines = doc.text.split("\n");
        let touched = false;
        for (const { target, sha: recorded } of pinned(bundle, doc)) {
            const actual = bundle.blobSha(target);
            if (actual === null || actual === recorded)
                continue;
            for (let i = 0; i < lines.length; i += 1) {
                if (lines[i].trim().startsWith("source_blob_sha:") && lines[i].includes(recorded)) {
                    lines[i] = lines[i].replaceAll(recorded, actual);
                    touched = true;
                    break;
                }
            }
        }
        if (touched) {
            fs.writeFileSync(doc.path, lines.join("\n"), "utf8");
            changed.add(doc.path);
        }
    }
    return changed;
}
