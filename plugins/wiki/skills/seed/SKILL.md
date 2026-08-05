---
name: seed
description: Open conversation seeding on an OKF wiki bundle - from this point every decision the person states is written immediately to `inbox/conversation/` as its own record. Use on "seed the conversation", "start capturing decisions", "record this into the wiki", or at the start of a design discussion whose outcome belongs in the bundle. The flush skill closes it.
---

# Seed a conversation

This is the OPENING bracket. Invoking it declares seeding active for the rest of the
session. The flush skill closes it.

## While seeding is active

The moment the person STATES a decision, write the record - before answering, before
implementing, not at the end of the session.

One record per decision, at `inbox/conversation/YYYY-MM-DD-<slug>.md` inside the bundle.
`<slug>` is kebab-case from the decision. Name taken? Append `-2`, then `-3`.

Not every utterance. A decision is one that is about to become a concept or change one.
Questions, thinking aloud, and instructions to you are not decisions.

## The record

Two frontmatter keys and no more. The flush lands records in `raw/`, where the generated
store index lists them by `type` and describes them by `description`.

```markdown
---
type: Record
description: <the decision, one line>
---

# <YYYY-MM-DD> - <the decision, one line>

- Speaker: human:<id>
- Decision: <what was decided>
- Reason: <as stated>
- Rejected: <the alternatives named, and why>
- Open: <what was left undecided>
- Supersedes: <path of the record or concept this replaces>
```

- `Speaker` follows the OKF actor convention (§7): `human:<id>` for a person,
  `<producer>/<version>` for an agent, `process:<id>` for an automated process.
- `Reason`: write "no reason given" rather than invent one.
- `Rejected`: "none named". `Open`: "nothing". `Supersedes`: omit unless it does.
- Prose never hard-wraps: a sentence stays on one line, however long. A break in the
  bytes survives every copy; viewers soft-wrap.
- Never the transcript. Never your own reasoning. Only what was said.

A file the person hands the bundle - a paper, a spec, a page - is dropped into `inbox/`
as it stands. It is queue, not a record; the flush classifies it.

## Correcting

Records stay correctable until the flush: while the discussion still moves, edit the
record in place.

After the flush a concept pins the landed copy. From then on a change of mind is a NEW
record naming what it supersedes - never an edit to what landed.

## Inside inbox/

Exactly two things are yours to do: add a record, and (during the flush) move items out.
No edits to items you did not write, no deletions, no `index.md`, no restructuring.

Unflushed records are safe. `vwiki validate` reports the queue as a WARN
(`inbox/  N item(s) waiting - a flush is pending`) and the exit code stays 0. Never
"tidy" the queue by deleting.
