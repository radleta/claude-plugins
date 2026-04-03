# Pattern Category 1: Investigation Protocols

### Pattern 1: Basic Investigation Protocol

**Context:** When skill needs agents to discover project patterns before acting.

**Before (Human-Optimized):**
```markdown
## Investigation

Before making changes, understand the codebase:
- Look at file organization
- Find naming patterns
- Identify architectural patterns

This helps ensure your changes fit the project.
```

**After (Agent-Optimized):**
```xml
<protocol name="pre-implementation-investigation" type="investigation" required="true">
  <objective>
    Gather project-specific context to ensure changes align with existing patterns
  </objective>

  <rationale>
    Investigation prevents misalignment. 5 minutes invested saves hours of rework.
  </rationale>

  <investigation-areas>
    <area id="file-organization" priority="high">
      <what-to-discover>File and directory structure patterns</what-to-discover>
      <success-criteria>
        - Identified where similar files are located
        - Understood directory naming conventions
        - Documented folder hierarchy
      </success-criteria>
      <tools>Glob, Read</tools>
    </area>

    <area id="naming-patterns" priority="high">
      <what-to-discover>Naming conventions for files, classes, functions</what-to-discover>
      <success-criteria>
        - Identified casing conventions (camelCase, snake_case, PascalCase)
        - Documented prefix/suffix patterns
        - Found naming rules from examples
      </success-criteria>
      <tools>Grep, Read</tools>
      <examples>
        <pattern>components/UserProfile.tsx (PascalCase for components)</pattern>
        <pattern>utils/formatDate.ts (camelCase for utilities)</pattern>
      </examples>
    </area>
  </investigation-areas>

  <dependencies>
    <prerequisite>Must complete investigation before implementation</prerequisite>
    <blocks>All implementation tasks</blocks>
  </dependencies>

  <output-format>
    Document findings in investigation report:
    ```
    File Organization:
    - Pattern: [describe pattern]
    - Examples: [show example paths]

    Naming Conventions:
    - Files: [pattern]
    - Classes: [pattern]
    - Functions: [pattern]
    ```
  </output-format>
</protocol>
```

**Why Better for Agents:**
- Explicit objective and rationale
- Each area has specific success criteria
- Tools specified
- Dependencies explicit
- Output format defined
- Examples for pattern recognition

---

### Pattern 2: Investigation Output Format

**Context:** Specifying what investigation report should contain.

**Before:**
```markdown
Document your findings about the codebase.
```

**After:**
```markdown
**Output Format (Required):**

```
Investigation Report: [Project Name]

## Project Type
- Type: [library|application|CLI|service|framework]
- Primary language: [language]
- Framework: [framework name or "none"]

## File Organization
Pattern: [describe the organizational pattern]
Examples:
- [path example 1]
- [path example 2]
- [path example 3]

## Naming Conventions
- Files: [pattern with example]
- Directories: [pattern with example]
- Classes: [pattern with example]
- Functions: [pattern with example]
- Variables: [pattern with example]

## Code Style
- Indentation: [spaces/tabs, count]
- Quotes: [single/double]
- Semicolons: [required/optional/forbidden]
- Line length: [number or "not specified"]
- Other: [notable style choices]

## Testing Approach
- Framework: [Jest/Pytest/JUnit/etc. or "none found"]
- Test location: [path pattern]
- Test naming: [pattern]
- Coverage standard: [percentage or "not specified"]
- Mocking approach: [library and pattern if applicable]

## Dependencies & Libraries
- [Library 1]: [purpose]
- [Library 2]: [purpose]
- [Key patterns using these libraries]

## Architectural Patterns
- Primary pattern: [MVC/MVVM/Clean Architecture/etc.]
- Evidence: [what indicates this pattern]
- Deviations: [any inconsistencies noted]

## Key Patterns to Follow
1. [Most important pattern 1]
2. [Most important pattern 2]
3. [Most important pattern 3]
```
```

**Why Better:**
- Exact structure specified
- All required sections listed
- Consistent across investigations
- Validatable (all sections present?)

---
