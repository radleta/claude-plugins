---
name: check-folders
description: "Claude Code folder check and setup: checks this folder and the user-scope folder, reports in plain words, fixes only on a yes, keeps versions. Use when someone says \"check everything\" or asks to check their setup or folders, set them up, save a version, see saved versions or get an earlier copy back; load it before running any command. Placing one item is where-it-goes."
---

# Check Folders

The person may know nothing about version tools. They see a plain report and plain questions; you run every command yourself.

## Plain words

Everything you say or write to the person uses everyday words. The words `git`, `commit`, `repository`, `stage`, `branch`, `push` and `merge` never appear in your replies, your questions, or the version messages you save; [`saving-versions.md`](saving-versions.md) gives the words to use instead. Command lines run in your tool calls, never quoted back to the person. Claude Code's own terms stay as they are, user scope, project scope, marketplace and enabled, each explained in plain words the first time it comes up, as `checks.md` words them.

## The two folders

- **This folder** — the folder Claude Code was started in (the current directory). Claude Code calls it the project; the first time you say "project", say it means this folder, not a Project in the Claude app.
- **The user-scope folder** (`{U}` in commands) — where Claude Code keeps what applies to every project on this computer. The first time you name it, say so in those words. It is `$CLAUDE_CONFIG_DIR` when that variable is set, otherwise `~/.claude`. Find it with `echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"`.

Commands run in Git Bash on Windows and in any Unix shell, so use forward slashes and POSIX tools.

## Quoting

Every command you run follows this, in every check and fix. A folder or file name, a plugin name read from settings, a name, an email, or a version message can hold `$`, backticks or quotes, and any of them can come from a folder someone else made. Inside double quotes the shell still runs `$(…)` and backticks. So put every such value in single quotes, writing each `'` inside it as `'\''`, and pass the version message on standard input through a quoted heredoc, which the shell never expands:

```
git -C '{folder}' commit --quiet -F - <<'END_OF_VERSION_MESSAGE'
{message}
END_OF_VERSION_MESSAGE
```

A version message is one line: remove any line break from it first, so no line of it can end the heredoc early.

## Settings that start programs

A folder whose versions someone else set up carries their settings, and some settings start a program whenever versions are read or saved. Two guards, in every folder:

- Every `git` command you run starts `git -c core.fsmonitor=false -c core.hooksPath=/dev/null -c commit.gpgSign=false -c log.showSignature=false -c gc.auto=0 -c maintenance.auto=false -c submodule.recurse=false`; these pages write it as `git` for short. That turns off the file monitor, hooks, signing a save, showing signatures, housekeeping after a save, and a restore reaching into nested versions, and nothing else. Every `status` and `diff` also takes `--ignore-submodules=all`, so it never runs a check inside nested versions, and every `diff`, `log -p` or `show` takes `--no-ext-diff --no-textconv`.
- A folder's versions can be set to cover another folder, or be kept somewhere else. So once `rev-parse` shows a folder keeps versions, and before any other `git` command there, check where. Take `{top}` from `git -C '{folder}' rev-parse --show-toplevel`. Git can print a path in another form than the shell (`C:/…` against `/c/…` in Git Bash), so compare a path only once resolved: `$(cd '{folder}' && cd '{path}' && pwd -P)` for a path git prints, and `$(cd '{folder}' && pwd -P)` for `{folder}` itself. Four tests: the resolved `{folder}` equals the resolved `{top}` or starts with it and a `/` (the top is that folder or one above it); `[ ! -L '{top}/.git' ]` succeeds, and `find '{top}/.git' -type l 2>&1` exits 0 and prints nothing, not even an error, since a folder `find` can't read could hide a link; and both `git -C '{folder}' rev-parse --absolute-git-dir` and `git -C '{folder}' rev-parse --git-common-dir`, resolved, equal the resolved `{top}` followed by `/.git`. When any fails, run nothing else there and report under **Could not tell**: "{folder}'s versions are set up to cover or be kept in another folder ({where}), so I didn't look inside them."
- Filter and diff programs can't be turned off by that prefix. So once `rev-parse` shows a folder keeps versions, and after the check above, read its settings with `git -C '{folder}' config --show-scope --name-only --list`, in a tool call of its own with nothing after it, and check every line whose scope is `local` or `worktree` before the next command. When a name, compared without regard to case, starts with `filter.`, `gpg.`, `gc.`, `include.` or `includeIf.`, or is `diff.external`, a `diff.*.command` or a `diff.*.textconv`, run nothing else in that folder's versions. Report it under **Could not tell**: "{folder} keeps versions with settings that can start programs ({the names}), so I didn't look inside its versions. Check them with whoever set the folder up." Offer no version fix there. A folder this skill set up never has them.
- Nested versions carry settings of their own. When the folder that keeps versions holds a `.gitmodules` file, or `git -C '{folder}' ls-files -s` shows a line starting `160000`, treat it the same way: under **Could not tell**, "{folder} holds another folder's versions inside it ({path}), so I didn't look inside its versions."
- A folder below that keeps its own versions would be saved by `add -A` as a bare pointer, none of its files included. So before starting versions and before every `add -A`, search the whole of `{top}`, the folder whose versions you are starting or saving: the folder itself when starting (this folder, or `{U}` in check 3), otherwise what `git -C '{folder}' rev-parse --show-toplevel` names. Run `(cd '{top}' && find . -path ./.git -prune -o -iname .git -prune -print)`, with none of the skips in `checks.md`. When `{top}` is `{U}`, a `./{path}/.git` outside the folders its list lets back in (`skills/`, `agents/`, `commands/`, `rules/`, `output-styles/`) is already left out and needs no line. Then run the same command with `-path '*[[:cntrl:]"\\]*'` before `-print`; when it prints anything, a name holds a line break, a control character, `"` or `\`, so save nothing and report under **Could not tell**: "{top} holds a folder with an unusual name that keeps its own versions, so I didn't save a version." Otherwise, for each `./{path}/.git` found (in any case, such as `.GIT`), write the line `/{path}/` with a `\` before each `\`, `[`, `]`, `*` and `?` in `{path}`; unless `{top}/.gitignore`, the list of files not to keep versions of, already has that line, add it and tell the person: "{path} keeps its own versions, so this folder's versions leave it out." After every `add -A`, run `git -C '{top}' -c core.quotePath=false ls-files -s`, which with those names refused prints every path as it is; for each line starting `160000`, take that entry back out with `git --literal-pathspecs -C '{top}' rm --cached -f --quiet -- '{path}'` (only the pointer goes; its files stay on disk) and add its line to the list as above, before saving.
- A list of files not to keep versions of can be a link to a file outside the folder, such as a shell startup file, and a line added to it would land there. So before reading or writing any `.gitignore`, here, in check 3 or in `saving-versions.md`, check that it is absent or a plain file: `[ ! -L '{file}' ] && { [ ! -e '{file}' ] || [ -f '{file}' ]; }`. When that fails, write nothing to it, save nothing, and report under **Could not tell**: "{folder}'s list of files not to keep versions of points somewhere else, so I didn't change it or save a version."
- `.claude` or `CLAUDE.md` in a folder someone else made can be a link too, so a move or write meant for this folder would land elsewhere, such as the user-scope folder, where it loads in every project. So before any write or move into `./.claude/` or to `./CLAUDE.md`, two tests:
  1. The destination and every path on the way to it (`./.claude`, `./.claude/skills` and so on) is not a link: `[ ! -L '{path}' ]` for each, whether or not it exists.
  2. Of `./.claude` and the folders below it on that way, take the deepest that exists as a folder; `$(cd '{it}' && pwd -P)` must start with `$(pwd -P)/`. When none exists, or the destination sits directly in this folder, there is nothing to resolve and this test passes.

  So `./CLAUDE.md` is only checked for being a link; `./.claude/settings.json` checks `./.claude` and the file for links, then resolves `./.claude` when it exists; a move to `./.claude/skills/{name}` checks the three paths, then resolves `./.claude/skills`, or `./.claude` when only that exists; editing `./.claude/skills/{name}/SKILL.md` checks the four paths and resolves `./.claude/skills/{name}`. When any test fails, change nothing and report under **Could not tell**: "{path} in this folder points somewhere else, so I didn't change it."

## Run

1. **Check.** Run every check in [`checks.md`](checks.md), in order, against the folder it names. Looking changes nothing: no check writes, moves, or creates a file. Done when each check has a result: fine, needs fixing, or could not tell.
2. **Report.** One report in plain words, in up to three parts:
   - **Fine** — one line per check that passed, and each line a check marks as information.
   - **Could not tell** — one line per check whose look gave no answer, saying what is unknown and why; never file it under Fine.
   - **Needs fixing** — one numbered item per finding: what you found, what the fix would do, and the folder it changes (this folder, the user-scope folder, or a named subfolder). Say which fixes change files and which are steps the person takes.

   Leave out a part with nothing in it. End the report by asking which fixes to make. A setup is this same run on a folder where most checks fail. Done when the report is shown and the question asked; then stop and wait for the answer.
3. **Fix on a yes.** Make only the fixes the person said yes to, one at a time, each by its fix in `checks.md`. A fix they decline or don't mention stays in the report as not fixed and is offered again on the next run. Before the first saved version in a folder, follow `saving-versions.md`. Done when every approved fix is made or has failed, and you have said in plain words what changed, in which folder, and what didn't happen.

When the person asks to see their saved versions or get an earlier copy of a file back, run no checks: follow [`saving-versions.md` § Earlier copies](saving-versions.md#earlier-copies).

## Hard limits

- Versions stay on this machine: never add an online copy or send versions anywhere.
- Only ever add to history: nothing that rewrites or throws away saved versions or changes (no `reset --hard`, `rebase`, `push --force`, `clean`, or `checkout --` on changed files).
- Settings for saved versions are set for one folder only, never for every folder on the machine (no `--global`).
