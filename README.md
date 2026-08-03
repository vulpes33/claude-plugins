# claude-plugins

Personal Claude Code plugin catalog.

    /plugin marketplace add vulpes33/claude-plugins

| Plugin | What it is | Install |
|--------|-----------|---------|
| `wiki` | Wiki mechanics for OKF knowledge bundles - `vwiki` CLI, ruleset, agent skill ([repo](https://github.com/vulpes33/vulpes-wiki)) | `/plugin install wiki@vulpes` |

Each plugin lives in its own repository (or under `plugins/` here for small ones);
this repository is only the catalog.

> Note: current Claude Code rejects git-url plugin sources and resolves github
> sources over ssh. Until that lands, `vulpes-wiki` installs as its own marketplace:
> `/plugin marketplace add vulpes33/vulpes-wiki` → `/plugin install wiki@vulpes`.
