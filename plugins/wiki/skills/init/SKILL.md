---
name: init
description: Create an OKF knowledge bundle with `vwiki init` and adopt the vulpes-wiki ruleset. Use when a project has no wiki bundle yet - "set up the wiki", "start a .wiki bundle", "bootstrap an OKF bundle" - or when another wiki task finds no bundle root.
---

# Create a bundle

A bundle root is the directory whose `index.md` carries `okf_version`. One already
exists? Nothing to create - use the validate skill.

`vwiki` is on PATH when the plugin is installed; from a checkout it is `bin/vwiki`.

## 1. Lay the skeleton down

    vwiki init [<dir>]        # default: .wiki

Copies the template - root `index.md` plus one generated `index.md` for `product/`,
`conventions/`, `reference/` - and makes `raw/` and `inbox/` empty. They are empty
because git carries no empty directory; they reach git with their first file.

Refusals, all judged before anything is written: the target is already a bundle, sits
inside one, or exists and is not empty. A failure rolls back and names any leftover it
could not remove - remove those before retrying. Exit 2 means the tool could not run;
never hand-build the skeleton in response.

## 2. Adopt the ruleset

Separate and deliberate. No adoption record means no version gate at all - the tool
checks the bundle but never tells it that the rules moved.

Read the shipped version from the packaged `ruleset/manifest.yaml` (beside `bin/vwiki`).
Never hardcode it. Write `<dir>/conventions/ruleset.md`:

```markdown
---
type: Convention
title: Adopted ruleset
description: The ruleset this bundle follows.
ruleset: { name: vulpes-wiki-ruleset, version: <shipped version> }
status: draft
generated: { by: "<producer>/<version>", at: "<ISO 8601 datetime>" }
---

# Adopted ruleset

This bundle follows vulpes-wiki-ruleset <shipped version>.
```

- `ruleset:` MUST be the one-line flow mapping above. A block mapping parses as no
  adoption at all - the bundle is then silently unversioned.
- The path is exactly `conventions/ruleset.md`. The gate reads no other file.
- A concept that rests on a ruleset rule pins this record, never a file in the package:
  a pin the checker cannot verify is worse than none.

## 3. Declare the project's own conventions (optional)

Language and writing rules are the project's, not the ruleset's. Write them as an
ordinary concept, `conventions/project.md`, `type: Convention`. English is assumed when
absent.

## 4. Gate

    vwiki validate <dir> --fix     # regenerates the indexes your new files changed
    vwiki validate <dir>           # expect exit 0

## Never

- Hand-write `index.md` or `log.md`; `--fix` generates the index.
- Write `verified` - that is a person's, and only after they read the concept.
- Create a subdirectory under a group directory before three or more documents there
  share one category.
