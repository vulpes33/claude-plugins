/**
 * Every markdown link resolves to a real file.
 *
 * Links into `raw/` are resolved like any other. That directory is excluded from
 * the rules, not from the filesystem, and a `sources` entry pointing at a stored
 * original is a link that has to work.
 *
 * `log.md` is one exception: a log entry records paths as they were at its
 * commit, and history has no duty to resolve in the current tree. Checking it
 * would force rewriting the log whenever a file moves, which the log rules forbid.
 * A `verbatim: true` document is the other: its body is an external text, and
 * its links resolve in the world it came from, not in this bundle.
 */
import fs from "node:fs";
import { ERROR, finding } from "../finding.js";
export const CHECK = "links";
export function run(bundle) {
    const findings = [];
    for (const doc of bundle.checked) {
        if (doc.name === "log.md")
            continue;
        if (doc.meta.verbatim === "true" || doc.meta.verbatim === true)
            continue;
        for (const { target, line } of doc.links()) {
            const resolved = bundle.resolve(doc, target);
            if (resolved === null)
                continue;
            if (!fs.existsSync(resolved)) {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    line,
                    message: `${target} does not resolve`,
                }));
            }
        }
    }
    return findings;
}
