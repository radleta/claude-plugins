# PR Writer - Reference Guide

This reference guide contains detailed checklists, advanced techniques, and comprehensive information to supplement the main PR Writer skill.

## Table of Contents
1. [Self-Review Checklist](#self-review-checklist)
2. [Commit Message Best Practices](#commit-message-best-practices)
3. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
4. [Merge Strategy Considerations](#merge-strategy-considerations)
5. [PR Workflow Checklist](#pr-workflow-checklist)
6. [Special Scenarios](#special-scenarios)
7. [Advanced Tips](#advanced-tips)
8. [Language-Specific Considerations](#language-specific-considerations)
9. [Resources & Tools](#resources--tools)

---

## Self-Review Checklist

**Before submitting your PR, review it yourself:**

### Code Quality
- [ ] Code follows project style guidelines
- [ ] No unnecessary console.logs, commented code, or debug statements
- [ ] No new warnings or errors introduced
- [ ] Code is self-documenting or has clear comments
- [ ] Variable/function names are descriptive
- [ ] No magic numbers or strings (use constants)

### Testing
- [ ] All existing tests pass locally
- [ ] New tests added for new functionality
- [ ] Tests cover edge cases and error conditions
- [ ] Manual testing completed
- [ ] Tested on target browsers/platforms

### Documentation
- [ ] Code comments explain "why" not "what"
- [ ] README updated if needed
- [ ] API documentation updated if needed
- [ ] Migration guide included for breaking changes

### Security & Performance
- [ ] No sensitive data exposed (API keys, passwords, PII)
- [ ] Input validation added where needed
- [ ] No obvious performance regressions
- [ ] Database queries optimized (no N+1 queries)

### Git Hygiene
- [ ] Commit messages are clear and follow conventions
- [ ] No merge conflicts
- [ ] No unnecessary files committed (.env, node_modules, etc.)
- [ ] Feature branch is up to date with base branch

### Review Experience
- [ ] PR is focused on a single concern
- [ ] PR size is reasonable (< 400 lines ideally)
- [ ] Description is complete and helpful
- [ ] Screenshots included for UI changes
- [ ] Highlighted areas needing extra scrutiny

---

## Commit Message Best Practices

### Format (Conventional Commits)
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Rules
- **Subject line**: Imperative mood, no period, < 50 chars
- **Body**: Explain what and why (not how), wrap at 72 chars
- **Footer**: Reference issues, breaking changes

### Examples
```
feat(auth): add OAuth2 support for Google login

Implements Google OAuth2 flow using passport-google-oauth20.
Users can now sign in with their Google accounts, reducing
friction for new user signups.

Closes #567
```

```
fix: prevent race condition in cache invalidation

The cache was being read before invalidation completed,
causing stale data to be served. Now using await to ensure
invalidation completes before subsequent reads.

Fixes #892
```

```
feat!: migrate to async user service

BREAKING CHANGE: UserService methods now return Promises.
See MIGRATION.md for upgrade guide.
```

---

## Common Mistakes to Avoid

### ❌ Size Anti-patterns
- **Monolithic PRs**: 1000+ lines that take hours to review
- **Kitchen sink**: Multiple unrelated changes bundled together
- **Work-in-progress**: Submitting incomplete code

### ❌ Documentation Failures
- **No description**: Just a title, no context
- **Vague descriptions**: "Fixed bug" with no details
- **Missing test instructions**: Reviewers can't verify changes
- **No screenshots**: UI changes with no visual reference

### ❌ Testing Oversights
- **No tests**: New code with zero test coverage
- **Failing tests**: CI is red, "will fix later"
- **Untested edge cases**: Happy path only
- **No manual testing**: "Looks good to me" without running it

### ❌ Review Anti-patterns
- **No self-review**: Submitting without reviewing your own diff
- **Defensive attitude**: Fighting every review comment
- **Rubber-stamping**: Approving without actually reviewing
- **Force pushing during review**: Rewriting history while being reviewed

### ❌ Communication Gaps
- **Ghost PRs**: No response to review comments for days
- **Assumed context**: Not explaining non-obvious decisions
- **Missing migration guides**: Breaking changes with no upgrade path
- **Ignoring conventions**: Not following team standards

---

## Merge Strategy Considerations

### Three Main Strategies

**1. Merge Commit** (Preserve all history)
- **Pros**: True history, easy to revert entire feature
- **Cons**: Cluttered history, harder to bisect
- **When**: Open source, need attribution, archival projects

**2. Squash and Merge** (Clean, linear history)
- **Pros**: One commit per PR, clean main branch, easy to read
- **Cons**: Loses granular commit history, harder to bisect large squashes
- **When**: Fast-moving teams, prefer clean history, PRs are well-scoped

**3. Rebase and Merge** (Linear, preserves commits)
- **Pros**: Clean linear history, keeps commit granularity, easier to bisect
- **Cons**: Rewrites history, can cause issues if rebasing during review
- **When**: Want linear history AND commit detail

### Best Practices by Strategy

**If using Squash Merge:**
- Make PR title follow conventional commits (it becomes the commit message)
- Ensure PR description is comprehensive (commit history is lost)
- Don't worry about commit quality during development

**If using Rebase Merge:**
- Keep commits atomic and well-structured
- Write good commit messages (they're preserved)
- Avoid force pushing during active review

**If using Merge Commits:**
- Accept some history noise
- Use merge commit message to summarize the feature
- Good for open source with many contributors

---

## PR Workflow Checklist

### 1. Before Starting
- [ ] Create feature branch from latest main/develop
- [ ] Branch name follows conventions (feat/*, fix/*, etc.)
- [ ] Understand the requirements fully

### 2. During Development
- [ ] Keep PR scope focused and small
- [ ] Write tests as you go
- [ ] Commit frequently with clear messages
- [ ] Self-review your changes before pushing

### 3. Before Submitting
- [ ] Pull latest changes from base branch
- [ ] Resolve merge conflicts if any
- [ ] Run full test suite locally
- [ ] Run linter and fix issues
- [ ] Review your own diff on GitHub/GitLab
- [ ] Remove debug code, console.logs, commented code
- [ ] Verify no sensitive data committed

### 4. Writing the PR
- [ ] Write clear, descriptive title
- [ ] Fill out complete description (What/Why/How)
- [ ] Add testing instructions
- [ ] Include screenshots for UI changes
- [ ] Add breaking change warnings if applicable
- [ ] Request reviewers from appropriate teams
- [ ] Add relevant labels (bug, feature, etc.)
- [ ] Link related issues

### 5. During Review
- [ ] Respond to comments promptly (within 24 hours)
- [ ] Be open to feedback and suggestions
- [ ] Explain decisions respectfully if disagreeing
- [ ] Update PR based on feedback
- [ ] Re-request review after making changes
- [ ] Thank reviewers for their time

### 6. After Approval
- [ ] Ensure CI/CD passes
- [ ] Rebase if needed (check team policy)
- [ ] Merge using team's preferred strategy
- [ ] Delete feature branch
- [ ] Verify deployment (if auto-deployed)
- [ ] Close related issues
- [ ] Update project board/tracker

---

## Special Scenarios

### Refactoring PRs
- **Extra important**: Explain why the refactor is needed
- **Split it up**: Refactor in one PR, new feature in another
- **Prove safety**: Show tests passing before and after
- **Highlight benefits**: Performance, maintainability, etc.

### Emergency Hotfixes
- **Be explicit**: Mark as [HOTFIX] in title
- **Keep minimal**: Only fix the critical issue
- **Fast-track**: Request immediate review
- **Follow up**: Create issue for proper fix/tests if needed

### Documentation-Only PRs
- **Still important**: Follow same rigor
- **Include preview**: Screenshots of rendered docs
- **Check links**: Verify all links work
- **Proofread**: Spelling and grammar matter

### Large Unavoidable PRs
- **Break it down**: Split into reviewable sections in description
- **Guide reviewers**: "Review files in this order..."
- **Consider alternatives**: Could this be multiple PRs?
- **Be patient**: Large PRs take time

---

## Advanced Tips

### Making Review Easier
1. **Order matters**: Structure commits in logical order
2. **Use draft PRs**: For early feedback before completion
3. **Add line comments**: Explain tricky code sections proactively
4. **Record demos**: Video walkthroughs for complex UIs
5. **Split reviews**: Request different reviewers for different aspects

### Handling Feedback
1. **Acknowledge quickly**: "Thanks, will fix" shows you're engaged
2. **Ask questions**: "Could you clarify X?" is perfectly fine
3. **Suggest alternatives**: "What about Y approach instead?"
4. **Resolve systematically**: Check off items as you address them
5. **Know when to push back**: Politely disagree with reasoning

### Optimizing for Speed
1. **Small PRs merge faster**: Keep them tiny when possible
2. **Morning submissions**: Better than Friday afternoon
3. **Ping politely**: "Friendly reminder" after 24-48 hours
4. **Pre-review**: Get feedback before "official" submission
5. **Pair programming**: Review as you code

### Building Trust
1. **Consistent quality**: Every PR should meet high standards
2. **Thoughtful descriptions**: Show you care about reviewers' time
3. **Responsive to feedback**: Quick, professional responses
4. **Learn and improve**: Incorporate feedback into future PRs
5. **Help others**: Review others' PRs with same care

---

## Language-Specific Considerations

### Frontend PRs
- Include screenshots/GIFs of UI changes
- Test on multiple browsers
- Verify responsive design
- Check accessibility (keyboard nav, screen readers)
- Note bundle size impact

### Backend PRs
- Include API endpoint changes
- Document response format changes
- Note database migration needs
- Highlight performance implications
- Cover security considerations

### Infrastructure PRs
- Explain infrastructure changes clearly
- Include rollback procedure
- Note cost implications
- Describe monitoring/alerting updates
- Plan deployment strategy

---

## Resources & Tools

### PR Templates
- GitHub: `.github/pull_request_template.md`
- GitLab: `.gitlab/merge_request_templates/default.md`

### Helpful Tools
- **Conventional Commits**: commitlint, commitizen
- **PR Size**: danger-js, pull-request-size-checker
- **Screenshots**: LICEcap (GIF), Loom (video)
- **Code Review**: GitHub Copilot, CodeRabbit, Graphite

### Metrics to Track
- PR size (lines of code)
- Time to first review
- Number of review cycles
- Time to merge
- Defect rate post-merge
