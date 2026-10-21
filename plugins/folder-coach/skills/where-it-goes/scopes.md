# Scopes and Loading Rules

Claude Code reads its instructions and tools from folders, and calls each place a **scope**. Where a file sits decides which sessions see it. A **project** is the folder Claude was started in, not a Project in the Claude app. **Agents** are helpers Claude can hand a task to; **commands** are shortcuts you type as `/name`.

## The scopes

| Scope | In plain words | Where | Who sees it |
|---|---|---|---|
| User scope | every project on this computer | `~/.claude/` (or `$CLAUDE_CONFIG_DIR` when set): `CLAUDE.md`, `skills/`, `agents/`, `commands/`, `rules/`, `output-styles/`, `settings.json` | every session on this computer, in every folder |
| Project scope | this folder | `CLAUDE.md` and `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/settings.json` | everyone who has the folder |
| Local scope | just you, in this folder | `.claude/settings.local.json` | only you, on this computer |

Local scope holds settings and enabled plugins. A skill, agent or command can't be put in local scope itself. For one just for you in this folder, there are two routes. Put it in user scope with a description that names this folder: it's there in every project, but Claude uses it only here. Or, so it loads only here, put it in a plugin and enable that plugin just for you in this folder (`--scope local`): the plugin is what sits in local scope.

A **plugin** is a package of skills, agents and commands kept in a folder of your own. It isn't a scope: each project that wants it enables it (switches it on), and only those projects see it (for example `my-plugins/sped/`).

Pick the narrowest place that covers everyone who needs the item. A skill loaded where it isn't needed can fire on the wrong request.

## How loading works

- **CLAUDE.md** loads from the folder Claude started in and from every folder above it. A `CLAUDE.md` in a subfolder loads only after Claude opens a file in that subfolder.
- **Skills, agents and commands** in a folder's `.claude/` load in sessions started in that folder or any folder inside it. Starting in a parent folder, a child's skills appear only after Claude opens a file in that child, and the child's agents and commands never appear.
- **Settings:** a project's `.claude/settings.json` is shared with anyone who has the folder and applies only to sessions started in that folder itself, not in its subfolders, so a plugin it enables loads only when Claude is started there. `.claude/settings.local.json` stays on this computer. The user-scope `settings.json` applies everywhere.

## Plugins: a folder of your plugins

A folder of your plugins, which Claude Code calls a marketplace, holds each plugin in its own folder, for example `my-plugins/`:

```
my-plugins/
  .claude-plugin/marketplace.json   { "name": "my-plugins",
                                      "owner": { "name": "{your name}" },
                                      "plugins": [ { "name": "sped", "source": "./sped" } ] }
  sped/
    .claude-plugin/plugin.json      { "name": "sped", "description": "…" }
    skills/  agents/  commands/
```

The first `name` in `marketplace.json`, outside the plugin list, is the marketplace's name, the part after `@` below.

- **Once per computer:** `claude plugin marketplace add '{path to my-plugins}'`. This records the folder's full path in the user-scope settings.
- **In each project that wants it:** `claude plugin install 'sped@my-plugins' --scope project`, run in that project. It enables the plugin in the project's `.claude/settings.json` (`enabledPlugins`); `--scope local` enables it just for you, in `.claude/settings.local.json`. The same setting written by hand works too, once the marketplace is added on this computer.
- **Edits load live** from the folder at the next session start, or after `/reload-plugins`. No reinstall.
- **Names stay apart:** a plugin's items are called `{plugin}:{item}`, such as `sped:iep-goals`, so a plugin skill never collides with a project skill of the same name. A project that doesn't enable the plugin sees none of its items.

Example: a teacher who works at two schools keeps the special-education skills both schools use in a plugin, `my-plugins/sped/`, enables it in each school's folder, starts Claude in the school's folder rather than a class subfolder, and keeps each school's own skills in that school's `.claude/skills/`.

## What doesn't copy itself

- **Another computer** gets nothing automatically: copy the user-scope folder's `CLAUDE.md`, `skills/`, `agents/`, `commands/`, `rules/` and `output-styles/`, and your folder of plugins (`my-plugins/`), then add the marketplace again on that computer: each computer keeps its own note of where the folder of plugins is, so the new one has to be told. Projects that already enable a plugin load it from then on, with no install.
- **A moved folder of plugins:** add the marketplace again from the new path; Claude Code points the existing one at the new place.
- **`.claude/settings.local.json`** and the user-scope `settings.json` stay on the computer they're on.
- **Login details** are never copied or kept in saved versions: `.credentials.json` in the user-scope folder on Windows and Linux, the Keychain on a Mac.
