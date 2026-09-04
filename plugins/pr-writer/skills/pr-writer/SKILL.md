---
name: pr-writer
description: "Comprehensive framework for creating well-structured pull requests with best practices for titles, descriptions, and test plans. Use when creating PRs, writing PR descriptions, preparing code for review, or improving PR quality — even for small single-commit PRs."
---

# PR Writer - Professional Pull Request Creation

I am an expert at creating high-quality pull requests that get reviewed quickly and merged confidently. I follow industry best practices for PR titles, descriptions, testing documentation, and self-review processes.

## Core Principles

**🚨 CRITICAL: Only include sections that are relevant to your PR!** Empty or non-applicable sections waste reviewer time and create noise. When in doubt, leave it out.

### 1. **Keep PRs Small and Focused**
- Target **50-250 lines of code** (max 400 for complex features)
- One PR = One logical change (feature, bugfix, refactor, etc.)
- PRs under 250 lines get reviewed **40% faster** than larger ones
- Reviewers should spend **< 15 minutes** reviewing your PR

### 2. **Single Responsibility**
- Each PR addresses **one specific task or feature**
- Don't bundle unrelated changes (typo fixes, formatting, etc.)
- Split large features into multiple incremental PRs when possible
- Exception: Related refactoring needed to implement the feature

### 3. **Clear Communication**
- Titles should be immediately understandable
- Descriptions explain **WHAT, WHY, and HOW**
- Include context for reviewers unfamiliar with the work
- Guide reviewers through the changes

## PR Title Best Practices

### Format

Use one of these proven formats:

**Option 1: Conventional Commits (Recommended)**
```
<type>: <description>
<type>(<scope>): <description>
<type>!: <description> (breaking change)
```

**Common types:**
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation only
- `refactor` - Code restructuring (no behavior change)
- `perf` - Performance improvements
- `test` - Adding/updating tests
- `chore` - Maintenance tasks
- `ci` - CI/CD changes
- `style` - Code style/formatting

**Option 2: With Issue Reference**
```
<type>: <description> (#issue-number)
feat: add user profile view (closes #123)
```

**Option 3: Simple Bracket Format**
```
[#issue] Description
[#456] Fix overflow bug in user profile modal
```

### Title Rules

✅ **DO:**
- Use **imperative mood**: "Add feature" not "Added" or "Adds"
- Keep under **50 characters** when possible
- Be specific: "Fix login button unresponsive on Safari" not "Fix bug"
- Include issue/ticket numbers when applicable
- Start with conventional commit prefix

❌ **DON'T:**
- Use vague titles: "Update files", "Fix issue", "Changes"
- Write in past tense: "Fixed bug", "Added feature"
- Be too generic: "Bug fix", "Improvements"
- Exceed 72 characters (hard limit)

### Examples

**Good:**
```
feat: implement user profile edit functionality
fix: resolve memory leak in image cache manager
docs: update API authentication guide
refactor: extract validation logic to separate module
perf: optimize database queries for dashboard
feat!: migrate to v2 API (breaking change)
```

**Bad:**
```
Updates
Fixed stuff
Changes to the code
bug fix
WIP - don't merge
```

## PR Description Framework

### The "What, Why, How" Approach

**WHAT** - Summary of changes (required)
- High-level overview
- Reference related issues

**WHY** - Context and motivation (for non-obvious changes)
- Why is this necessary?
- What problem does it solve?

**HOW** - Implementation details (for complex changes)
- Key design decisions
- Areas needing scrutiny
- Tradeoffs made

### Required Sections

**Every PR must include:**
1. **Summary** - What changed
2. **Testing** - How you verified it works

**For detailed examples, see @EXAMPLES.md**

### Choosing the Right Template

**Start minimal and add sections only when needed.** Use this decision tree:

```
Is the PR < 100 lines with straightforward changes?
├─ YES → Use Minimal Template (Summary + Testing)
└─ NO → Use Standard Template (+ Motivation, Implementation)

Does the PR have UI changes?
└─ YES → Add Screenshots section

Does the PR introduce breaking changes?
└─ YES → Add Breaking Changes section

Does the PR significantly affect performance?
└─ YES → Add Performance Impact section

Does the PR involve security-sensitive code?
└─ YES → Add Security Considerations section

Did you add/update dependencies?
└─ YES → Add Dependencies section

Is the PR high-risk (migrations, infrastructure)?
└─ YES → Add Rollback Plan section
```

**Default approach:** Start with Summary + Testing, then add sections as needed.

### Template Structure

**IMPORTANT:** Only include sections that are relevant to your specific PR. Empty or non-applicable sections create noise and waste reviewer time.

#### Minimal Template (for simple PRs)

Use this for straightforward bug fixes, small features, or documentation updates:

```markdown
## Summary
[Brief description of what this PR does]

Closes #[issue-number]

## Testing
- [ ] Tested manually
- [ ] All existing tests pass
```

For simple PRs (< 100 lines, obvious changes), this is often sufficient!

#### Standard Template (for most PRs)

```markdown
## Summary
[Brief description of what this PR does]

Closes #[issue-number]

## Motivation
[Why is this change needed? What problem does it solve?]

## Implementation
[How did you implement this? Highlight key decisions]

### Key Changes
- [Change 1]
- [Change 2]
- [Change 3]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

### Steps to Test
1. [Step 1]
2. [Step 2]
3. [Expected result]
```

#### Optional Sections (include ONLY when applicable)

Add these **only if they apply**:
- **Screenshots** - For UI changes
- **Breaking Changes** - With migration guide
- **Performance Impact** - With before/after metrics
- **Security Considerations** - For security-sensitive changes
- **Dependencies** - If adding/updating packages
- **Rollback Plan** - For high-risk changes

**For template examples, see @EXAMPLES.md**

### When to Include Optional Sections

| Section | Include When |
|---------|-------------|
| **Screenshots/Videos** | Any UI/visual changes |
| **Breaking Changes** | API changes, schema changes, behavior changes that break existing code |
| **Performance Impact** | Intentional performance work OR changes that may impact performance |
| **Security Considerations** | Authentication, authorization, data validation, encryption, or security-sensitive code |
| **Dependencies** | Adding, removing, or significantly updating dependencies |
| **Rollback Plan** | Database migrations, infrastructure changes, or high-risk deployments |
| **Additional Notes** | Important context that doesn't fit elsewhere (rarely needed) |

**Default rule:** If you're unsure whether to include a section, leave it out. Reviewers can always ask for more info.

## Before Submitting

### Quick Pre-Submission Checklist
- [ ] Self-review your own diff
- [ ] All tests pass locally
- [ ] No debug code or console.logs
- [ ] PR is focused and reasonably sized (< 400 lines)
- [ ] Description includes Summary + Testing

**For complete checklist, see @REFERENCE.md**

## When to Use This Skill

I will help you create professional pull requests when:

✅ **Creating new PRs** - Guide you through writing titles and descriptions
✅ **Improving existing PRs** - Review and enhance PR quality
✅ **Before requesting review** - Self-review checklist
✅ **Writing commit messages** - Follow conventional commits
✅ **Documenting breaking changes** - Migration guides
✅ **Adding test documentation** - Testing strategies and steps
✅ **UI/UX changes** - Screenshot best practices
✅ **Large refactoring** - Structuring complex PRs
✅ **Emergency hotfixes** - Fast-track procedures

## Key Reminders When Creating PRs

1. **Start minimal** - Summary + Testing is often enough
2. **Add sections only when relevant** - Don't include empty sections
3. **Match the PR size** - Simple PRs get simple descriptions
4. **Focus on value for reviewers** - What do they need to know?
5. **When in doubt, leave it out** - Reviewers can ask for more details

## Final Thoughts

A well-crafted PR is a form of **asynchronous communication**. You're not just sharing code—you're telling a story about what changed, why it matters, and how to verify it works.

**Respect your reviewers' time** by making PRs easy to understand and review. The investment in a good PR description pays dividends in faster reviews, fewer questions, and smoother merges.

**Quality over speed**: Taking an extra 10 minutes to write a great PR description can save hours of back-and-forth and potential bugs.

For additional examples and templates, see @EXAMPLES.md
