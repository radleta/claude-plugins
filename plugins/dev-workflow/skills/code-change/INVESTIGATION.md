# Project Investigation Guide

Before making any code changes, understand the project context through systematic investigation. This guide provides **what to investigate**, not how - use your judgment and tools to gather the information.

---

## Investigation Principles

### 1. Context Before Code
Never write code before understanding the project. Five minutes of investigation saves hours of rework.

### 2. Follow, Don't Invent
Projects have established patterns. Your job is to discover and follow them, not introduce new conventions.

### 3. Ask Questions Through Exploration
The codebase itself answers most questions. Look for similar functionality, existing patterns, and established conventions.

### 4. Document Your Findings
Create a clear investigation report to reference throughout the change process.

---

## Investigation Checklist

Use this checklist to ensure you've gathered all necessary context before making changes.

### Technology Stack & Environment

**What to discover:**
- [ ] Primary programming language(s) and version(s)
- [ ] Web framework or application type (if applicable)
- [ ] Build system and tooling
- [ ] Package manager and dependency management
- [ ] Runtime environment requirements
- [ ] Current project version

**Why it matters:** Determines syntax, patterns, and available libraries

**What you need to know:**
- Which language features are available at this version
- What framework patterns to follow
- How to build and run the project

---

### Code Organization & Patterns

**What to discover:**
- [ ] File and directory organization strategy (feature-based, type-based, layered, etc.)
- [ ] Naming conventions for files (kebab-case, PascalCase, snake_case, etc.)
- [ ] Naming conventions for functions/methods
- [ ] Naming conventions for classes/modules
- [ ] Naming conventions for constants and variables
- [ ] Architectural patterns in use (MVC, MVVM, Clean Architecture, microservices, etc.)
- [ ] State management approach (if applicable)
- [ ] API design patterns (REST, GraphQL, RPC, etc.)
- [ ] Error handling patterns
- [ ] Logging patterns

**Why it matters:** Your changes must match existing code style and structure

**What you need to know:**
- Where to place new files
- How to name new functions/classes
- Which architectural patterns to follow
- How similar functionality is already implemented

**How to find out:**
- Search for similar functionality in the codebase
- Review file organization in main source directory
- Examine existing modules that do similar things
- Look at how errors are handled in similar code
- Check how logging is done throughout the project

---

### Documentation Standards

**What to discover:**
- [ ] README structure and content
- [ ] CHANGELOG format and location
- [ ] CHANGELOG versioning scheme (Semantic Versioning, date-based, etc.)
- [ ] CHANGELOG entry format (Keep a Changelog, Conventional Changelog, custom)
- [ ] Inline documentation style (JSDoc, docstrings, Javadoc, XML docs, etc.)
- [ ] Documentation generator in use (if any)
- [ ] API documentation approach (if applicable)
- [ ] Architecture documentation location (if exists)
- [ ] Contributing guidelines (if exists)

**Why it matters:** Documentation must be updated in the project's established format

**What you need to know:**
- Where to document your changes
- What format to use for each type of documentation
- What level of detail is expected
- How to structure CHANGELOG entries

**How to find out:**
- Read the existing README
- Review recent CHANGELOG entries
- Look at inline documentation in similar code
- Check for documentation directories
- Look for CONTRIBUTING.md or similar files

---

### Testing Approach

**What to discover:**
- [ ] Testing framework and tools
- [ ] Test directory structure and location
- [ ] Test file naming conventions
- [ ] Test organization (mirrors source, separate, by type)
- [ ] Unit testing approach and patterns
- [ ] Integration testing approach (if applicable)
- [ ] Test coverage requirements or goals
- [ ] Mocking/stubbing patterns
- [ ] Test data and fixture patterns
- [ ] CI/CD test execution setup

**Why it matters:** Tests must follow project conventions and meet coverage standards

**What you need to know:**
- Where to place test files
- How to name test files
- What testing patterns to follow
- What coverage is expected
- How to mock dependencies
- What assertions style to use

**How to find out:**
- Find and examine existing test files
- Look at test configuration files
- Review tests for similar functionality
- Check CI/CD configuration for test commands
- Look for coverage configuration

---

### Code Quality Standards

**What to discover:**
- [ ] Linting tools and configuration
- [ ] Code formatting tools and style
- [ ] Type checking approach (if applicable)
- [ ] Pre-commit hooks (if any)
- [ ] Code review checklist or guidelines (if exists)
- [ ] Import/dependency organization patterns
- [ ] Comment and documentation expectations

**Why it matters:** Code must pass quality checks and match project style

**What you need to know:**
- What quality tools will run on your code
- What formatting is required
- What linting rules must be satisfied
- How to organize imports
- When comments are needed

**How to find out:**
- Look for linter configuration files
- Look for formatter configuration files
- Look for pre-commit configuration
- Examine existing code formatting
- Check for .editorconfig or similar

---

### Version Control Conventions

**What to discover:**
- [ ] Commit message format and conventions
- [ ] Branch naming patterns
- [ ] PR/MR description expectations
- [ ] PR/MR template (if exists)
- [ ] Issue reference format
- [ ] Merge strategy (merge commits, squash, rebase)

**Why it matters:** Your commits and PRs must follow team conventions

**What you need to know:**
- How to format commit messages
- How to name branches
- What to include in PR descriptions
- How to reference issues

**How to find out:**
- Review recent commit messages in git history
- Look at existing branch names
- Check for PR/MR templates
- Review recent merged PRs

---

## Investigation Process

### Step 1: Gather Information

Use your tools and judgment to answer the questions in each checklist section. Don't follow a rigid script - adapt your investigation based on what you find.

### Step 2: Look for Similar Code

Find examples of similar functionality in the codebase. This is often the fastest way to understand patterns.

**Questions to answer:**
- Has something similar been implemented before?
- Where is it located?
- How is it structured?
- What patterns does it follow?
- How is it tested?
- How is it documented?

### Step 3: Identify Consistency Patterns

Look for patterns that repeat across the codebase:
- File naming patterns
- Function naming patterns
- Error handling patterns
- Testing patterns
- Documentation patterns

### Step 4: Note Project-Specific Conventions

Every project has unique conventions. Document anything unusual or project-specific that you'll need to follow.

### Step 5: Create Investigation Report

Document your findings in a clear, organized format that you can reference while making changes.

---

## Investigation Report Template

Use this template to organize your findings:

```markdown
# Project Investigation Report

## Technology Stack
- **Language:** [language and version]
- **Framework:** [framework and version]
- **Build System:** [build tool]
- **Package Manager:** [package manager]
- **Project Version:** [current version]

## Code Organization
- **Structure:** [feature-based/type-based/layered/etc.]
- **File Naming:** [convention observed]
- **Function Naming:** [convention observed]
- **Class Naming:** [convention observed]
- **Architecture:** [pattern observed]
- **Similar Code:** [location of similar functionality]

## Documentation Standards
- **README:** [location and structure]
- **CHANGELOG:** [location and format]
- **Inline Docs:** [style and tool]
- **API Docs:** [location if applicable]

## Testing Approach
- **Framework:** [testing framework]
- **Test Location:** [directory/pattern]
- **Test Naming:** [convention]
- **Coverage Goal:** [percentage if found]
- **Organization:** [mirrors source/separate/etc.]

## Code Quality
- **Linter:** [tool and config location]
- **Formatter:** [tool and config location]
- **Type Checking:** [tool if applicable]
- **Pre-commit Hooks:** [yes/no, what runs]

## Version Control
- **Commit Format:** [convention observed]
- **Branch Naming:** [pattern observed]
- **PR Template:** [yes/no, location]

## Project-Specific Notes
[Any unusual patterns or conventions specific to this project]

## Change Strategy
Based on investigation, the approach for this change will be:
- Follow [pattern] found in [location]
- Match [naming convention] from [examples]
- Add tests following [pattern]
- Document in [format]
- Update CHANGELOG using [format]
```

---

## Investigation Best Practices

### Do:
- ✅ **Take time to investigate thoroughly** - Don't rush this phase
- ✅ **Look at multiple examples** - Patterns become clear with repetition
- ✅ **Document your findings** - You'll reference them throughout the change
- ✅ **Ask when unclear** - Better to clarify than guess
- ✅ **Adapt your approach** - Every project is different

### Don't:
- ❌ **Skip investigation** - This always leads to rework
- ❌ **Assume patterns** - What works in one project may not work here
- ❌ **Ignore existing conventions** - Follow the project's way, not your preferences
- ❌ **Stop at surface level** - Dig deeper to understand why patterns exist
- ❌ **Forget to document** - Your future self needs this information

---

## When Investigation is Complete

You're ready to proceed when you can confidently answer:

1. **Where does this change belong?** (file location, organization)
2. **How should I name things?** (files, functions, classes)
3. **What patterns should I follow?** (architecture, error handling, etc.)
4. **How should I test this?** (framework, location, coverage)
5. **How should I document this?** (inline, README, CHANGELOG)
6. **What quality checks must pass?** (linting, formatting, type checking)
7. **How should I commit this?** (message format, branch naming)

If you can't answer these questions, continue investigating.

---

## Investigation Red Flags

Stop and investigate more deeply if you encounter:

- 🚩 **Multiple conflicting patterns** - Project may be in transition, understand why
- 🚩 **No clear conventions** - Ask about preferred approach before proceeding
- 🚩 **Outdated patterns** - Old code may not reflect current standards
- 🚩 **Inconsistent quality** - Some areas may have higher standards than others
- 🚩 **Missing documentation** - Consider what documentation should exist

---

## Project Types & Common Patterns

Different project types have typical patterns:

### Web Applications
- Often feature-based or MVC organization
- REST or GraphQL APIs common
- Frontend/backend separation or monolithic
- State management patterns
- Authentication/authorization patterns

### Libraries/Packages
- Often type-based organization
- Public API carefully designed
- Extensive documentation expected
- Comprehensive test coverage required
- Semantic versioning important

### CLI Tools
- Often command-based organization
- Argument parsing patterns
- Output formatting conventions
- Error message standards
- Help text expectations

### Microservices
- Service-specific patterns
- API contract standards
- Inter-service communication patterns
- Deployment conventions
- Monitoring/logging requirements

**Use project type to guide your investigation focus.**

---

## Summary

Investigation is about **understanding context**, not following a script. Use your judgment, tools, and abilities to:

1. **Understand the technology stack** - What you're working with
2. **Discover existing patterns** - How things are done here
3. **Identify conventions** - What rules to follow
4. **Find similar code** - Working examples to learn from
5. **Document your findings** - Create a reference for the change

**The goal: Make changes that feel native to the project, not foreign.**

When your changes are indistinguishable from existing code in style, structure, and quality - your investigation was successful.
