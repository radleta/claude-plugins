# Command Validation Checklist

> Complete validation checklist for slash command files. Referenced from SKILL.md.

## CRITICAL (Must Pass)

- [ ] **Filename is descriptive and action-oriented**
  - How to verify: Read filename - does it describe action? (review-pr.md, cmd.md)
  - Check: Hyphenated, lowercase, action verb + object

- [ ] **YAML frontmatter is valid (if present)**
  - How to verify: Check opening `---` on line 1, closing `---` with blank line after
  - Run: `grep $'\t' file.md | wc -l` should return 0 (no tabs)
  - Check: 2-space indentation, no tabs, valid property names

- [ ] **No blank lines before frontmatter**
  - How to verify: File must start with `---` or content (no blank line 1)

- [ ] **Description is clear and specific**
  - How to verify: Description meets ALL 3 criteria:
    1. Length: `echo "$desc" | wc -w` returns 10-50 words
    2. Contains action verb (analyze, create, review, deploy, test, etc.)
    3. Includes tool/domain context (git, PR, code, dependencies, etc.)
  - Pass example: "Create a git commit with conventional commit format" (9 words, has verb "create", has context "git commit")
  - Fail example: "Does stuff" (2 words, vague verb, no context)

- [ ] **Argument variables used correctly**
  - How to verify: Search for `$` - only $ARGUMENTS or $0, $1, $2 present
  - Run: `grep '$ARG[^U]' file.md` should return nothing
  - Run: `grep '\\${[0-9]}' file.md` should return nothing (no bash-style ${0})

- [ ] **argument-hint matches actual usage**
  - How to verify: Count $ variables in prompt, compare to hint
  - If using $0, $1 -> hint shows `<arg0> <arg1>`
  - If using $ARGUMENTS -> hint shows `<args>`

- [ ] **Tool permissions match USER REQUEST**
  - How to verify: Apply @QUALITY.md "Appropriate" Tool Permissions decision matrix (lines 15-96)
  - Check: Did user explicitly request restrictions?
  - **If NO restrictions mentioned:** OMIT allowed-tools property entirely
  - **If YES restrictions requested:** Add allowed-tools per user's specific request with precise patterns

- [ ] **File references use @ prefix**
  - How to verify: Search for file paths - documentation references use @filename.md
  - Example: @QUALITY.md (correct), QUALITY.md (incorrect, unless literal filename in example)

## HIGH PRIORITY (Should Pass)

- [ ] **No shell syntax in prompt (no if/then/else)**
  - How to verify: Search prompt for `if `, `then`, `else`, `fi`, `case`, `while`, `for` keywords
  - These belong in bash scripts, not command prompts

- [ ] **Command name doesn't conflict**
  - How to verify: Run `ls .claude/commands/*.md | grep filename` - should show only this file
  - Check Claude Code slash command list for conflicts

- [ ] **Location is correct (project vs personal)**
  - How to verify:
    - Team-useful commands -> `.claude/commands/` (project)
    - Personal workflow commands -> `~/.claude/commands/` (user)

- [ ] **Tool restrictions match user request (see @QUALITY.md "Appropriate" Tool Permissions)**
  - How to verify: Did user explicitly request restrictions? If no -> omit allowed-tools
  - Cross-reference with QUALITY.md decision matrix if restrictions were requested

- [ ] **Model uses alias (sonnet/opus/haiku) if specified, not full ID**
  - How to verify: Check `model:` property - should be `sonnet` not `claude-sonnet-4-20241022`
  - Valid: sonnet, opus, haiku, default
  - Invalid: claude-*, full model IDs

## MEDIUM PRIORITY (Nice to Have)

- [ ] **CI/CD validation integration**
  - How to verify: Can validation commands be automated?
  - Run syntax checks in CI: `grep $'\t' .claude/commands/*.md | wc -l` should return 0
  - Validate frontmatter: `head -n 20 .claude/commands/*.md | grep -c "^---$"` should return even number
  - Add to pre-commit hooks or GitHub Actions for automated validation

- [ ] **Configuration precedence understood**
  - How to verify: If multiple properties conflict, which wins?
  - Command-level settings override conversation settings
  - Frontmatter `model` overrides conversation model
  - Frontmatter `allowed-tools` restricts beyond conversation permissions
  - No conflicts expected between frontmatter properties (each is independent)
