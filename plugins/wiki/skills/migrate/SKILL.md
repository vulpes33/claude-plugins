---
name: migrate
description: Bring an OKF wiki bundle up to the ruleset version the installed vwiki ships. Use on validate's `adoption` WARN ("bundle adopts ... the packaged ruleset is ..."), after upgrading the wiki plugin, or on "migrate the wiki", "update the adopted ruleset version".
---

# Migrate a bundle to the shipped ruleset

Trigger: the `adoption` WARN - the bundle adopts an older version than the tool ships.
It rides on exit 0; nothing else is broken by it alone.

The opposite case is NOT this skill's work: exit 2 reading `refuses to check against a
newer ruleset than it carries` means the bundle is ahead of the tool. Update the plugin or
the package. Never lower the adoption record to silence it, and never work around the gate.

## 1. Read both versions

- Shipped: `version:` in the packaged `ruleset/manifest.yaml` (beside `bin/vwiki`).
- Adopted: `ruleset: { name: ..., version: X.Y.Z }` in the bundle's `conventions/ruleset.md`.
- Names differ: the tool refuses the bundle (exit 2). It follows someone else's ruleset -
  stop and report.

## 2. The digit that changed defines the work

The manifest states what each digit means: major = adopting bundles restructure,
minor = a procedure step changes, patch = a constraint tightens.

| Bump | Work |
|------|------|
| patch | Update the adoption record. Nothing else. |
| minor | Read the shipped `ruleset/` for the step that changed, apply it to the bundle, then update the record. |
| major | Restructure the bundle against the shipped `ruleset/directories.md`: walk it folder by folder - what exists where, what must move, what must be rewritten. Write the plan down and get the person's approval BEFORE any file moves. Then update the record. |

Several digits moved at once (0.9.0 to 1.1.0): the highest one that changed defines the work.

## 3. While restructuring

- A move keeps the name and the content, and fixes every inbound link - the `links`
  findings tell you which.
- `raw/` is append-only: never edit, never delete. Its `index.md` is generated - `--fix`
  writes it, and a bundle that predates it gets one on the first `--fix`.
  Re-grouping there is a move and nothing else, and only where the directory rule asks -
  a subdirectory once three or more documents share one category.
- A restructure that changes what a confirmed concept says removes its `human:` entry and
  returns `status` to `draft`. Never write `verified`, and never set `status: stable` to
  make something look reviewed.

## 4. Finish

The record carries the shipped version, as the one-line flow mapping - a block mapping
parses as no adoption at all:

    ruleset: { name: vulpes-wiki-ruleset, version: <shipped version> }

Then:

    vwiki validate <bundle> --fix
    vwiki validate <bundle>

Done is exit 0 with no `adoption` WARN.
