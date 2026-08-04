/**
 * The index on disk against the index the rules produce.
 *
 * The rule is a MUST — an index is generated and never hand-written — so a
 * difference is an error, not advice.
 */
import fs from "node:fs";
import path from "node:path";
import { ERROR, finding } from "../finding.js";
import * as indexFile from "../generate/index-file.js";
export const CHECK = "index";
export function run(bundle) {
    const findings = [];
    for (const directory of indexFile.directoriesNeedingIndex(bundle)) {
        const target = path.join(directory, "index.md");
        const rel = path.relative(bundle.root, target).split(path.sep).join("/");
        const expected = indexFile.render(bundle, directory);
        if (!fs.existsSync(target)) {
            findings.push(finding({
                level: ERROR,
                check: CHECK,
                path: rel,
                message: "missing; the directory holds concepts",
            }));
            continue;
        }
        if (fs.readFileSync(target, "utf8") !== expected) {
            findings.push(finding({
                level: ERROR,
                check: CHECK,
                path: rel,
                message: "differs from what the rules generate",
            }));
        }
    }
    return findings;
}
