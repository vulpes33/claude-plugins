# claude-plugins

This catalog has moved to [vulpes-facility/claude-plugins](https://github.com/vulpes-facility/claude-plugins).
It keeps the marketplace name `vulpes`, so `vwiki@vulpes` installs as before,
and new vwiki releases are published there only.

    claude plugin marketplace add vulpes-facility/claude-plugins
    claude plugin install vwiki@vulpes

If you added this catalog, point `vulpes` at the new repository; vwiki stays installed:

1. If `~/.claude/settings.json` declares `extraKnownMarketplaces.vulpes`, set its `source.repo` to `vulpes-facility/claude-plugins`.
2. Run `claude plugin marketplace add vulpes-facility/claude-plugins`, then `claude plugin marketplace update vulpes`.

Apache-2.0 - see `LICENSE` and `NOTICE`.
