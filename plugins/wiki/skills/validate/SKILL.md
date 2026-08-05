---
name: validate
description: Run `vwiki validate` on an OKF knowledge bundle, resolve every finding (conformance, links, hashes, index, inbox, adoption), and then do the review pass the tool cannot - staleness re-reads and human verification. Use after editing a `.wiki/` bundle, before committing bundle changes, or on "check the wiki", "validate the bundle", "fix the vwiki findings".
---

# Validate a bundle

## 1. Run it

    vwiki validate [<bundle>] [--fix] [--json]

- `<bundle>` locates the root only. The run - and `--fix` - always cover the whole bundle.
- Parsing the output? `--json`. Never in the same call as `--fix`: fix prints the paths it
  wrote before the findings. Two calls, always.
- `--fix` repins stale hashes and regenerates indexes before checking. It is the only
  sanctioned writer of `source_blob_sha` values and `index.md` files.

Exit codes: 0 no ERROR (WARNs ride on 0 - read them before calling the bundle clean),
1 the bundle breaks a rule, 2 the tool could not run and says NOTHING about the bundle.
A stack trace is exit-2 behaviour whatever code is printed: fix the environment, never
the bundle.

The round: finish ALL content edits, judge every `hashes` finding, `vwiki validate --fix`,
then `vwiki validate`. Findings left start a new round. Never edit between the `--fix` and
the run that gates the round.

## 2. Findings

| Check | What to do |
|-------|------------|
| `conformance` | Fix the frontmatter: a parseable `---` block, and a non-empty `type` (§11). Never rename or move a file to silence it. |
| `links` | Fix the link, or create the target - except under `raw/`: never create a file there to satisfy a link, that fabricates provenance. Restore the original with git instead. |
| `hashes` | READ the concept against the changed source first. Substantive change: edit the concept this round, then repin. Cosmetic: nothing, `--fix` repins it. Pinned blob no longer in git: treat as substantive. Target under `raw/` changed: do NOT repin - a moved or edited original is damage, restore its bytes. |
| `index` | `vwiki validate --fix` regenerates it. Never hand-edit an `index.md`. If the generated file reads worse than a hand edit would, the generation rules are wrong - report that, do not merge a hand edit. |
| `inbox` (WARN) | Items are waiting. Offer the flush skill. |
| `adoption` (WARN) | The bundle lags the shipped ruleset. Offer the migrate skill. |

Enumerate every `hashes` finding by hand BEFORE any `--fix`: it repins the whole bundle at
once, and run early it launders a substantive upstream change into a fresh pin while the
depending concept silently keeps the old content.

`hashes` scope: only bundle-absolute (`/...`) resources are judged. A dead in-bundle
resource, and one cited without `source_blob_sha`, are ERRORs `--fix` cannot repair - fix
the resource, restore the file, or write the placeholder `source_blob_sha: <sha>` and let
`--fix` fill it.

Exit 2 reading `refuses to check against a newer ruleset than it carries` is the version
gate, not a finding: the bundle is ahead of the tool. See the migrate skill; never edit the
adoption record down to work around it.

## 3. The review pass

Exit 0 means no mechanical rule is broken. It says nothing about whether the content is
right, complete, or current. That part is yours and the person's.

- `stale_after` has arrived: re-read the concept against its sources. Still current - move
  the date forward. Not - edit it.
- Read the generated indexes as a reader would: an entry whose description restates its
  link text (`[x](x) - x`) marks a `description` to rewrite - identifier plus official
  title for an external work, one informative sentence otherwise.
- A person confirms a concept by reading it with what it links to and agreeing. Then, and
  only then:

```yaml
status: stable
verified:
  - { by: "human:<id>", at: <ISO 8601 datetime> }
```

  The `human:` prefix MUST be exact - a variant parses, passes conformance, and silently
  serves a lower trust tier (§5.3).
- An agent MUST NOT write `verified`. Authoring is not confirming, and a passing run is not
  review; it is the condition for asking for one. Asked to mark something reviewed: say a
  person has to read it.
- Confirmed content changes meaningfully, or a pinned hash breaks: in the same edit remove
  the `human:` entry and return `status: draft`. No path back to `stable` skips a fresh read.

## Never

- Hand-write `index.md`, `log.md`, `verified`, or a `source_blob_sha` value.
- Modify or delete anything under `raw/`, or hand-write the `index.md` there - `--fix` generates it.
- Rename or move a file to make a finding disappear.
- Invent the target of a broken link.
- Treat exit 2, or any stack trace, as a bundle finding.

More than one agent writing? Partition the files first, and exactly one agent runs `--fix`,
after every writer has stopped.
