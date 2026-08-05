---
type: Convention
title: Directories - what exists where
description: Each directory of a project knowledge bundle, and the files that exist in it.
tags: [convention, directories, portable]
status: draft
generated: { by: "claude-code/fable-5", at: "2026-08-04T10:40:00Z" }
---

## Rules

Inside a group directory, a subdirectory SHOULD NOT be created unless three or more documents whose main subjects share one category exist.

## Directories

### /

The wiki root.

- `index.md` - the table of contents, generated per the OKF rules
- `log.md` - the log, appended per the OKF rules
- The group directories registered below

### product/

Knowledge this project asserts.

- `index.md` - the generated table of contents
- `**/*.md` - the asserted knowledge, one concept per document

### conventions/

The rules this wiki must follow.

- `index.md` - the generated table of contents

### reference/

Information collected from external networks.

- `index.md` - the generated table of contents
- `**/*.md` - one document per collected work

### raw/

The originals of information and files collected from `inbox/` or external networks.
A file lands as an unmodified copy, and once placed it is never edited.
The spec's §8 indexes concepts and says nothing about a store of originals; these rules fill that silence and contradict none of it.

- `index.md` - the generated store index, at this level only; no subdirectory keeps one
- `**/*` - the originals; a stored file never takes the name `index.md`, which belongs to the generator
- The index carries no frontmatter, and lists `# Records` then `# Files` - both always present, each entry a path relative to `raw/`, sorted
- `# Records` - every `.md` here carrying `type: Record`, described by its own `description`
- `# Files` - every other stored file, described by the `title` of the first `sources` entry citing it, or that concept's `description` when the entry carries no title, or `cited by no concept`
- A conversation record carries `type: Record` and a one-line `description`, and nothing else

### inbox/

The folder that gathers what the wiki has to process.
No `index.md` is kept here.
Anyone other than a person may do nothing here except add a conversation record and move items to `raw/`.
