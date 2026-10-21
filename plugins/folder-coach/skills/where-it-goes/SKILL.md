---
name: where-it-goes
description: "Placement guide: whether a Claude Code skill, agent, command, CLAUDE.md or setting belongs in user scope, project scope or local scope, or in a plugin enabled in the projects that need it, and what to copy by hand. Use when someone asks where something goes, or is about to create or move one. A whole-folder check is check-folders; a passing mention of skills is not a placement question."
---

# Where It Goes

Answer in plain words, for someone who may not know how Claude Code loads its files. The scopes, the loading rules and plugins are in [`scopes.md`](scopes.md); read it before answering. Use Claude Code's own terms every time, user scope, project scope, local scope, marketplace and enabled, each explained in plain words the first time it comes up, as `scopes.md` words them ("enabled (switched on)"); never swap in other words for them.

1. **Find who uses the item.** Every project on this computer → user scope. This folder, for everyone who has it → project scope. Just this person, in this folder → local scope for a setting or an enabled plugin; a skill, agent or command can't be put in local scope itself, so offer two routes, as `scopes.md` words them: user scope with a description that names this folder, or, so it loads only here, a plugin that only you enable here. Some folders, chosen one by one (a team, a job, a subject taught at two schools) → a plugin, enabled in each folder that needs it. When the answer isn't clear from what the person said, ask: "Which of your folders should this work in, and is it just for you?"
2. **Answer.** Name the scope or the plugin, the exact folder the item goes in (filled in from this computer: the user-scope folder is `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`), and how it starts loading. For a plugin, say in plain words what setting it up takes: the folder of plugins, added once on this computer, and enabling the plugin in each folder that wants it. Offer to do it.
3. **Name the hand copies.** List everything [`scopes.md` § What doesn't copy itself](scopes.md#what-doesnt-copy-itself) says applies to this answer, or say there is nothing.

Done when the person has the scope or plugin, the folder, how it loads, and what to copy by hand. Create, move or set up anything only when they ask you to. You run every command yourself, in your tool calls; never read a command out or ask the person to type one. Put each folder path and name in a command in single quotes, writing a `'` inside it as `'\''`: inside double quotes the shell still runs `$(…)` and backticks a name can hold.
