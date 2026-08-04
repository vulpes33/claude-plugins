/**
 * The queue depth of `inbox/`.
 *
 * The inbox contents are excluded from every rule check - that is the point of
 * the inbox. What must not be silent is that something waits: a conversation
 * record written mid-session survives here as the pending state, and this WARN
 * is what keeps it from waiting forever. Queue depth is a reminder that a flush
 * is pending, not a judgment of the contents.
 */
import fs from "node:fs";
import path from "node:path";
import { finding, WARN } from "../finding.js";
export const CHECK = "inbox";
/** Every file under `dir`, recursively. */
function filesUnder(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...filesUnder(full));
        else
            out.push(full);
    }
    return out;
}
export function run(bundle) {
    const box = path.join(bundle.root, "inbox");
    let stat;
    try {
        stat = fs.statSync(box);
    }
    catch {
        return [];
    }
    if (!stat.isDirectory())
        return [];
    const waiting = filesUnder(box).filter((p) => path.basename(p) !== "index.md");
    if (!waiting.length)
        return [];
    return [
        finding({
            level: WARN,
            check: CHECK,
            path: "inbox/",
            message: `${waiting.length} item(s) waiting - a flush is pending`,
        }),
    ];
}
