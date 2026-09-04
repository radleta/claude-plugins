#!/usr/bin/env bash
# wiki-resolve — Resolve wiki domain path and output index content
# Used by thin expert skills via !`wiki-resolve <domain>` at load time
#
# Exit codes:
#   0 — success (index output)
#   1 — bad arguments OR domain not found

set -euo pipefail

# --- Argument validation ---
case "${1:-}" in
  -h|--help)
    cat >&2 <<'USAGE'
Usage: wiki-resolve <domain>

Resolves a wiki domain path and outputs its index content.
Used by thin expert skills to load wiki knowledge at skill load time.

Resolution order:
  Resolution 0: Skill-as-wiki: walk up from $PWD, find .claude/skills/<domain>/SKILL.md
                               (validated: SKILL.md present + '## Pages' heading + .mditerc entrypoint: SKILL.md)
  Resolution 1: Project walk-up: from $PWD up to .git/ boundary, find .wiki-memory/<domain>/
  Resolution 2: Install walk-up: from script install path, find .wiki-memory/<domain>/
  Resolution 3: Plugin:          detect plugins/ in path, find wikis/<domain>/

Output (success):
  <!-- wiki: /absolute/path/to/wiki/ -->
  <contents of SKILL.md or index.md>

Output (domain not found):
  <!-- wiki-resolve failed: <domain> not found — checked: ... -->
USAGE
    exit 0
    ;;
  "")
    echo "ERROR: domain argument required. Run 'wiki-resolve --help' for usage." >&2
    exit 1
    ;;
  -*)
    echo "ERROR: unknown option: $1. Run 'wiki-resolve --help' for usage." >&2
    exit 1
    ;;
esac

if [ $# -gt 1 ]; then
  echo 'ERROR: too many arguments — wiki-resolve takes exactly one domain argument' >&2
  exit 1
fi

domain="$1"

# --- Domain name validation (reject path traversal) ---
if [[ "$domain" == */* || "$domain" == *\\* || "$domain" == *..* || "$domain" == *" "* ]]; then
  echo "ERROR: domain must not contain '/', '\\', '..', or spaces." >&2
  exit 1
fi

checked_paths=()

# --- Resolution 0: Skill-as-wiki probe ---
# Walk up $PWD ancestors looking for .claude/skills/<domain>/ with:
#   1. SKILL.md present
#   2. '## Pages' heading in SKILL.md
#   3. .mditerc present with entrypoint: SKILL.md
# Reuses the resolve_self() symlink-loop pattern below (MSYS-safe; no readlink -f).
# Sets RESOLVED_PATH and RESOLVED_CONTENT_FILE on success; returns 0 on hit, 1 on miss.
# Never emits stderr. Never modifies the filesystem.
_resolve_skill_as_wiki() {
  local domain="$1"
  local dir="${PWD%/}"
  while [ -n "$dir" ]; do
    local skill_dir="$dir/.claude/skills/$domain"
    local skill_md="$skill_dir/SKILL.md"
    local mditerc="$skill_dir/.mditerc"
    if [[ -f "$skill_md" ]]; then
      if grep -q '^## Pages' "$skill_md" 2>/dev/null; then
        if [[ -f "$mditerc" ]] && grep -q '^entrypoint:[[:space:]]*SKILL\.md' "$mditerc" 2>/dev/null; then
          RESOLVED_PATH="$skill_dir/"
          RESOLVED_CONTENT_FILE="$skill_md"
          return 0
        fi
      fi
    fi
    local parent="$(dirname "$dir")"
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  return 1
}

RESOLVED_PATH=""
RESOLVED_CONTENT_FILE=""

if _resolve_skill_as_wiki "$domain"; then
  echo "<!-- wiki: $RESOLVED_PATH -->"
  cat "$RESOLVED_CONTENT_FILE"
  exit 0
fi

# --- Resolution 1: Project walk-up from $PWD ---
# $PWD is pinned to the session's project directory by CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR.
# Walk up looking for .wiki-memory/<domain>/, stopping at first .git/ so we don't cross repo boundaries.
walk_dir="${PWD%/}"
while [[ -n "$walk_dir" ]]; do
  candidate="$walk_dir/.wiki-memory/$domain"
  if [[ -d "$candidate" && -f "$candidate/index.md" ]]; then
    printf "WARN: wiki '%s' resolved via legacy %s/%s/ — migrate to skill-as-wiki layout under .claude/skills/%s/ (see /wiki-memory migrate)\n" \
      "$domain" ".wiki-memory" "$domain" "$domain" >&2
    echo "<!-- wiki: $candidate/ -->"
    cat "$candidate/index.md"
    exit 0
  fi
  checked_paths+=("project-walk($candidate)")
  [[ -d "$walk_dir/.git" ]] && break
  walk_parent="$(dirname "$walk_dir")"
  [[ "$walk_parent" == "$walk_dir" ]] && break
  walk_dir="$walk_parent"
done

# --- Resolution 2: Walk-up from script's real location ---
# Resolve $0 through symlinks (MSYS-safe — no readlink -f)
resolve_self() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}

script_dir="$(resolve_self)"

# Walk up to find .claude/ parent, then check .wiki-memory/{domain}/
walk_dir="$script_dir"
walk_found=""
while [[ "$walk_dir" != "/" && "$walk_dir" != "." ]]; do
  if [[ -d "$walk_dir/.claude" ]]; then
    parent_dir="$walk_dir"
    candidate="$parent_dir/.wiki-memory/$domain"
    if [[ -d "$candidate" && -f "$candidate/index.md" ]]; then
      walk_found="$candidate"
      break
    fi
    checked_paths+=("walk-up($candidate)")
    break
  fi
  walk_dir="$(dirname "$walk_dir")"
done

if [[ -n "$walk_found" ]]; then
  printf "WARN: wiki '%s' resolved via legacy %s/%s/ — migrate to skill-as-wiki layout under .claude/skills/%s/ (see /wiki-memory migrate)\n" \
    "$domain" ".wiki-memory" "$domain" "$domain" >&2
  echo "<!-- wiki: $walk_found/ -->"
  cat "$walk_found/index.md"
  exit 0
fi

# --- Resolution 3: Installed-plugin layout ---
# Detect plugins/ in the resolved path, look for wikis/{domain}/
plugin_found=""
case "$script_dir" in
  */plugins/*)
    # Extract up to the plugin root (first path containing plugins/NAME/)
    plugin_root="${script_dir%%/skills/*}"
    [[ "$plugin_root" == "$script_dir" ]] && plugin_root="${script_dir%%/scripts/*}"
    candidate="$plugin_root/wikis/$domain"
    if [[ -d "$candidate" && -f "$candidate/index.md" ]]; then
      plugin_found="$candidate"
    else
      checked_paths+=("plugin($candidate)")
    fi
    ;;
esac

if [[ -n "$plugin_found" ]]; then
  printf "WARN: wiki '%s' resolved via legacy %s/%s/ — migrate to skill-as-wiki layout under .claude/skills/%s/ (see /wiki-memory migrate)\n" \
    "$domain" "wikis" "$domain" "$domain" >&2
  echo "<!-- wiki: $plugin_found/ -->"
  cat "$plugin_found/index.md"
  exit 0
fi

# --- Failure: domain not found ---
(IFS=', '; echo "<!-- wiki-resolve failed: $domain not found — checked: ${checked_paths[*]} -->")
exit 1
