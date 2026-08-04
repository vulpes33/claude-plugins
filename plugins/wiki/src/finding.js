/**
 * Findings and how they are printed.
 *
 * One finding is one line. A human reads it, grep matches it, an agent parses it.
 */
export const ERROR = "ERROR";
export const WARN = "WARN";
export const INFO = "INFO";
const ORDER = { [ERROR]: 0, [WARN]: 1, [INFO]: 2 };
/** A finding, with its keys in the order the JSON output carries them. */
export function finding({ level, check, path, message, line = null, }) {
    return { level, check, path, message, line: line ?? null };
}
export function where(f) {
    return f.line ? `${f.path}:${f.line}` : f.path;
}
export function text(f, width = 0) {
    return `${f.level.padEnd(5)} ${f.check.padEnd(12)} ${where(f).padEnd(width)}  ${f.message}`;
}
export function compare(a, b) {
    const la = ORDER[a.level] ?? 9;
    const lb = ORDER[b.level] ?? 9;
    if (la !== lb)
        return la - lb;
    if (a.check !== b.check)
        return a.check < b.check ? -1 : 1;
    if (a.path !== b.path)
        return a.path < b.path ? -1 : 1;
    return (a.line ?? 0) - (b.line ?? 0);
}
export function render(findings, asJson) {
    const sorted = [...findings].sort(compare);
    if (asJson)
        return JSON.stringify(sorted, null, 2);
    if (!sorted.length)
        return "";
    const width = Math.max(...sorted.map((f) => where(f).length));
    return sorted.map((f) => text(f, width)).join("\n");
}
/** The highest level present, or null when there is nothing to report. */
export function worst(findings) {
    for (const level of [ERROR, WARN, INFO]) {
        if (findings.some((f) => f.level === level))
            return level;
    }
    return null;
}
