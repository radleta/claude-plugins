---
name: scratch-management
description: "Scratch folder lifecycle management using scratch.mjs script and archive branch workflow. Use when saving, archiving, initializing, or cleaning up scratch folders, managing agent context visibility, or hiding completed planning docs — even for simple single-folder operations."
---

<role>
  <identity>Scratch folder lifecycle executor using scratch.mjs script</identity>
  <purpose>Execute scratch folder operations (save, archive, list, initialize) to keep agent context clean</purpose>
  <scope>
    <in-scope>Initialize, save, archive, list scratch folders</in-scope>
    <out-of-scope>Creating folders (use mkdir), git ops outside scratch/</out-of-scope>
  </scope>
</role>

## Core Concept

| Location | Visible to Agents |
|----------|-------------------|
| `scratch/` on `main` branch | **Yes** - agents glob/grep/read this |
| `scratch/` on `archive` branch | **No** - not in working tree |

**Rule:** Archive completed folders to hide them from agents while preserving in git.

## Script Location

The `scratch` command is installed to `~/.local/bin/` via `install.sh` in this skill directory. Run `bash install.sh` if not yet installed.

Usage: `scratch <command> [folder]`

## Command Reference

| Command | Syntax | Use When |
|---------|--------|----------|
| **save** | `scratch save FOLDER` | Checkpoint active work |
| **archive** | `scratch archive FOLDER` | Hide completed folder from agents |
| **list** | `scratch list` | See active folders on main |
| **archived** | `scratch archived` | See archived folders |
| **config** | `scratch config` | Check configuration |

## Request Pattern Matching

<request-patterns>
  <pattern type="initialize">
    <triggers>
      <keyword>init</keyword>
      <keyword>initialize</keyword>
      <keyword>setup</keyword>
      <keyword>set up</keyword>
      <keyword>link</keyword>
      <context>git URL provided (github.com, gitlab.com, .git suffix, git@)</context>
    </triggers>
    <execute>Read protocols/initialize.md, then execute Initialize Protocol</execute>
  </pattern>

  <pattern type="save">
    <triggers>
      <keyword>save</keyword>
      <keyword>checkpoint</keyword>
      <keyword>commit scratch</keyword>
      <keyword>backup</keyword>
      <context>scratch folder + user wants to continue working</context>
    </triggers>
    <execute>Read protocols/save.md, then execute Save Protocol</execute>
  </pattern>

  <pattern type="archive">
    <triggers>
      <keyword>archive</keyword>
      <keyword>done</keyword>
      <keyword>complete</keyword>
      <keyword>finished</keyword>
      <keyword>clean up</keyword>
      <keyword>hide</keyword>
      <context>scratch folder + user finished with it</context>
    </triggers>
    <execute>Read protocols/archive.md, then execute Archive Protocol</execute>
  </pattern>

  <pattern type="status">
    <triggers>
      <keyword>list</keyword>
      <keyword>status</keyword>
      <keyword>what's in scratch</keyword>
      <keyword>show folders</keyword>
    </triggers>
    <execute>Read protocols/list.md, then execute List Protocol</execute>
  </pattern>

  <pattern type="confusion">
    <triggers>
      <phrase>agent is confused</phrase>
      <phrase>picking up old</phrase>
      <phrase>outdated context</phrase>
    </triggers>
    <execute>
      1. Read protocols/list.md, run List Protocol
      2. Ask user which folders to archive
      3. Read protocols/archive.md, run Archive Protocol for each
    </execute>
  </pattern>

  <pattern type="error">
    <triggers>
      <phrase>not initialized</phrase>
      <phrase>git error</phrase>
      <phrase>command failed</phrase>
    </triggers>
    <execute>Read troubleshooting.md for diagnosis and fixes</execute>
  </pattern>
</request-patterns>

## File Loading Protocol

<loading-protocol>
  <principle>Load only the protocol needed for the current operation</principle>

  <file path="protocols/initialize.md">
    <load-when>User provides git URL OR "not initialized" error</load-when>
    <contains>Full initialization steps preserving existing files</contains>
  </file>

  <file path="protocols/save.md">
    <load-when>User wants to checkpoint/save active work</load-when>
    <contains>Save protocol with verification steps</contains>
  </file>

  <file path="protocols/archive.md">
    <load-when>User wants to hide completed folder</load-when>
    <contains>Archive protocol with verification steps</contains>
  </file>

  <file path="protocols/list.md">
    <load-when>User wants status of scratch folders</load-when>
    <contains>List protocol with report format</contains>
  </file>

  <file path="troubleshooting.md">
    <load-when>Error occurs OR user reports issue</load-when>
    <contains>Common issues with step-by-step fixes</contains>
  </file>
</loading-protocol>

## Quick Decision Logic

```
User request received
    │
    ├─ Contains git URL? ──────────────► Load protocols/initialize.md
    │
    ├─ "save"/"checkpoint"? ───────────► Load protocols/save.md
    │
    ├─ "archive"/"done"/"clean up"? ───► Load protocols/archive.md
    │
    ├─ "list"/"status"? ───────────────► Load protocols/list.md
    │
    ├─ Error message? ─────────────────► Load troubleshooting.md
    │
    └─ Unclear? ───────────────────────► Ask user what operation they need
```

## Requirements

- Node.js 18+
- Git installed and in PATH
- scratch/ directory (will be created if missing during init)
