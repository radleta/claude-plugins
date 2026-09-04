# Brainstorming Process Flow

The control graph for `brainstorming/SKILL.md`. `## The flow` in that file is authoritative;
this graph is the same flow drawn, for when the branch structure is easier to see than to read.

```dot
digraph brainstorming {
    "Researcher read\n(or direct investigation)" [shape=box];
    "Init artifact set\n(idea + changelog + process-notes)\nor adopt existing idea.md" [shape=box];
    "Dialogue\n(idea.md + changelog.md\nupdated as decisions land)" [shape=box];
    "Open Questions empty?" [shape=diamond];
    "One review pass\n(alignment + domain, parallel)" [shape=box];
    "Findings?" [shape=diamond];
    "Plain inconsistency:\nfix inline" [shape=box];
    "Changes a decision:\none ruling batch to the user" [shape=box];
    "Append idea-loop entry\nto process-notes.md" [shape=box];
    "User reviews idea.md\n(git -C scratch diff)" [shape=diamond];
    "/implement-code {project}" [shape=doublecircle];

    "Researcher read\n(or direct investigation)" -> "Init artifact set\n(idea + changelog + process-notes)\nor adopt existing idea.md";
    "Init artifact set\n(idea + changelog + process-notes)\nor adopt existing idea.md" -> "Dialogue\n(idea.md + changelog.md\nupdated as decisions land)";
    "Dialogue\n(idea.md + changelog.md\nupdated as decisions land)" -> "Open Questions empty?";
    "Open Questions empty?" -> "Dialogue\n(idea.md + changelog.md\nupdated as decisions land)" [label="no"];
    "Open Questions empty?" -> "One review pass\n(alignment + domain, parallel)" [label="yes"];
    "One review pass\n(alignment + domain, parallel)" -> "Findings?";
    "Findings?" -> "Plain inconsistency:\nfix inline" [label="inconsistency"];
    "Findings?" -> "Changes a decision:\none ruling batch to the user" [label="decision-changing"];
    "Findings?" -> "Append idea-loop entry\nto process-notes.md" [label="none"];
    "Plain inconsistency:\nfix inline" -> "Append idea-loop entry\nto process-notes.md";
    "Changes a decision:\none ruling batch to the user" -> "Append idea-loop entry\nto process-notes.md";
    "Append idea-loop entry\nto process-notes.md" -> "User reviews idea.md\n(git -C scratch diff)";
    "User reviews idea.md\n(git -C scratch diff)" -> "Dialogue\n(idea.md + changelog.md\nupdated as decisions land)" [label="changes requested"];
    "User reviews idea.md\n(git -C scratch diff)" -> "/implement-code {project}" [label="approved"];
}
```
