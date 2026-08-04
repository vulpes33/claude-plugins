/**
 * OKF v0.2 conformance, implemented against the spec this package carries.
 *
 * Spec §11 defines conformance as three rules, all hard:
 *   1. every non-reserved `.md` contains a parseable YAML frontmatter block
 *   2. every frontmatter block carries a non-empty `type`
 *   3. reserved filenames (`index.md`, `log.md`) follow §8 / §9 when present
 *
 * Rule 3's decidable piece: frontmatter is permitted only on the bundle root's
 * `index.md` (the `okf_version` seed, §8), and on no `log.md` (§9).
 * Soft guidance (recommended fields, cross-links) stays out - §11 forbids
 * rejecting a bundle over it, and index content has its own check.
 * Excluded places are filtered by scope (`bundle.checked`), not by flag.
 */
import { parseFrontmatter } from "../bundle.js";
import { ERROR, finding } from "../finding.js";
export const CHECK = "conformance";
export function run(bundle) {
    const findings = [];
    for (const doc of bundle.checked) {
        const { end } = parseFrontmatter(doc.text);
        if (doc.isReserved) {
            if (end && doc.rel !== "index.md") {
                findings.push(finding({
                    level: ERROR,
                    check: CHECK,
                    path: doc.rel,
                    message: "frontmatter is permitted only on the bundle root's index.md (§8/§9)",
                }));
            }
            continue;
        }
        if (!end) {
            findings.push(finding({
                level: ERROR,
                check: CHECK,
                path: doc.rel,
                message: "no parseable YAML frontmatter block (§11.1)",
            }));
            continue;
        }
        if (!String(doc.meta.type ?? "").trim()) {
            findings.push(finding({
                level: ERROR,
                check: CHECK,
                path: doc.rel,
                message: "`type` is missing or empty (§11.2)",
            }));
        }
    }
    return findings;
}
