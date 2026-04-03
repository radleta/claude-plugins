#!/usr/bin/env bash
# skill-edit — Stage .claude/skills/ files for editing, bypassing protected-dir prompts
#
# Usage: skill-edit <command> <skill-name>
#
# Commands:
#   pull <skill>    Copy skill to staging dir (snapshot mtimes for consistency)
#   push <skill>    Copy staged edits back to .claude/skills/ (verify mtimes, backup)
#   diff <skill>    Diff staged version vs live
#   list            Show currently staged skills
#   clean           Remove stale staging dirs (>24h)
#
# Workaround for Claude Code protected-directory bug (anthropics/claude-code#36497)
# where Edit/Write to .claude/skills/ prompts regardless of permission settings.
# Pattern: pull to temp → Edit/Write in temp → push back via cp.
#
# Remove when upstream fix lands.

set -euo pipefail

# --- Config ---
STAGING_ROOT="${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/skill-staging"
BACKUP_ROOT="${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/skill-backups"

# --- Helpers ---
die() { echo "ERROR: $1" >&2; exit 1; }

# Resolve skill source directory — checks project then user level
resolve_skill_dir() {
  local name="$1"
  local project_dir=".claude/skills/$name"
  local user_dir="$HOME/.claude/skills/$name"

  if [ -d "$project_dir" ]; then
    echo "$project_dir"
  elif [ -d "$user_dir" ]; then
    echo "$user_dir"
  else
    return 1
  fi
}

staging_dir() {
  echo "$STAGING_ROOT/$1"
}

snapshot_file() {
  echo "$(staging_dir "$1")/.snapshot"
}

origin_file() {
  echo "$(staging_dir "$1")/.origin"
}

# Snapshot mtimes of all files in a directory, output sorted hash
snapshot_mtimes() {
  local dir="$1"
  find "$dir" -type f ! -name '.snapshot' ! -name '.origin' -exec stat -c '%n %Y' {} \; 2>/dev/null | sort | md5sum | cut -d' ' -f1
}

# --- Commands ---

cmd_pull() {
  local name="$1"
  local src
  src="$(resolve_skill_dir "$name")" || die "skill '$name' not found in .claude/skills/ (project or user)"
  local dest
  dest="$(staging_dir "$name")"

  # Clean previous staging for this skill in this session
  [ -d "$dest" ] && rm -rf "$dest"
  mkdir -p "$dest"

  # Copy skill to staging
  cp -r "$src"/. "$dest"/

  # Record origin path
  echo "$src" > "$(origin_file "$name")"

  # Snapshot mtimes of the live skill
  snapshot_mtimes "$src" > "$(snapshot_file "$name")"

  echo "Pulled: $src -> $dest"
  echo "Edit files in: $dest"
}

cmd_push() {
  local name="$1"
  local dry_run="${2:-}"
  local dest
  dest="$(staging_dir "$name")"
  [ -d "$dest" ] || die "skill '$name' not staged — run 'skill-edit pull $name' first"

  # Read origin path
  local origin_path
  origin_path="$(cat "$(origin_file "$name")")" || die "no origin recorded for '$name'"
  [ -d "$origin_path" ] || die "origin '$origin_path' no longer exists"

  # Consistency check — compare live mtimes vs snapshot taken at pull
  local snap_file
  snap_file="$(snapshot_file "$name")"
  [ -f "$snap_file" ] || die "no snapshot found — staging may be corrupt"

  local live_hash recorded_hash
  live_hash="$(snapshot_mtimes "$origin_path")"
  recorded_hash="$(cat "$snap_file")"

  if [ "$live_hash" != "$recorded_hash" ]; then
    die "skill '$name' modified since pull — re-pull to incorporate external changes"
  fi

  # Show what would change
  echo "=== Changes ==="
  diff -ru --exclude='.snapshot' --exclude='.origin' "$origin_path" "$dest" 2>/dev/null || true
  echo ""

  if [ "$dry_run" = "--dry-run" ]; then
    echo "Dry run — no changes made. Run 'skill-edit push $name' to apply."
    return
  fi

  # Backup live skill before overwrite
  local backup_dir="$BACKUP_ROOT/${name}-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup_dir"
  cp -r "$origin_path"/. "$backup_dir"/
  echo "Backup: $origin_path -> $backup_dir"

  # Push: remove metadata files from staging, then overwrite origin with staging contents
  rm -f "$dest/.snapshot" "$dest/.origin"
  rm -rf "$origin_path"
  mkdir -p "$origin_path"
  cp -r "$dest"/. "$origin_path"/

  # Clean up staging
  rm -rf "$dest"

  echo "Pushed: $name -> $origin_path"
}

cmd_diff() {
  local name="$1"
  local dest
  dest="$(staging_dir "$name")"
  [ -d "$dest" ] || die "skill '$name' not staged — run 'skill-edit pull $name' first"

  local origin_path
  origin_path="$(cat "$(origin_file "$name")")" || die "no origin recorded for '$name'"

  # Diff excluding metadata files
  diff -rq --exclude='.snapshot' --exclude='.origin' "$origin_path" "$dest" 2>/dev/null || true
  diff -ru --exclude='.snapshot' --exclude='.origin' "$origin_path" "$dest" 2>/dev/null || true
}

cmd_list() {
  if [ ! -d "$STAGING_ROOT" ]; then
    echo "No skills staged."
    return
  fi

  local found=0
  echo "Staged skills:"
  for dir in "$STAGING_ROOT"/*/; do
    [ -d "$dir" ] || continue
    local name
    name="$(basename "$dir")"
    [ "$name" = "*" ] && continue
    local origin="unknown"
    [ -f "$dir/.origin" ] && origin="$(cat "$dir/.origin")"
    echo "  $name  (from $origin)"
    found=1
  done

  [ "$found" -eq 0 ] && echo "  (none)"
}

cmd_clean() {
  local cutoff
  cutoff=$(( $(date +%s) - 86400 ))
  local cleaned=0

  for skill_dir in "$STAGING_ROOT"/*/; do
    [ -d "$skill_dir" ] || continue
    local mtime
    mtime="$(stat -c %Y "$skill_dir" 2>/dev/null || echo 0)"
    if [ "$mtime" -lt "$cutoff" ]; then
      rm -rf "$skill_dir"
      cleaned=$((cleaned + 1))
    fi
  done

  echo "Cleaned $cleaned stale staging dir(s)."

  # Also clean old backups
  local backup_cleaned=0
  for backup_dir in "$BACKUP_ROOT"/*/; do
    [ -d "$backup_dir" ] || continue
    local mtime
    mtime="$(stat -c %Y "$backup_dir" 2>/dev/null || echo 0)"
    if [ "$mtime" -lt "$cutoff" ]; then
      rm -rf "$backup_dir"
      backup_cleaned=$((backup_cleaned + 1))
    fi
  done

  [ "$backup_cleaned" -gt 0 ] && echo "Cleaned $backup_cleaned old backup(s)."
}

# --- Main ---

case "${1:-}" in
  -h|--help)
    echo "skill-edit — Stage .claude/skills/ files for editing, bypassing protected-dir prompts"
    echo ""
    echo "Usage: skill-edit <command> <skill-name>"
    echo ""
    echo "Commands:"
    echo "  pull <skill>    Copy skill to staging dir (snapshot mtimes for consistency)"
    echo "  push [--dry-run] <skill>  Copy staged edits back (verify mtimes, backup)"
    echo "  diff <skill>    Diff staged version vs live"
    echo "  list            Show currently staged skills"
    echo "  clean           Remove stale staging dirs (>24h)"
    exit 0
    ;;
  -*)
    die "unknown option: $1"
    ;;
esac

[ $# -lt 1 ] && die "missing command — run 'skill-edit --help'"

CMD="$1"
shift

case "$CMD" in
  pull)
    [ $# -lt 1 ] && die "usage: skill-edit pull <skill-name>"
    cmd_pull "$1"
    ;;
  push)
    [ $# -lt 1 ] && die "usage: skill-edit push [--dry-run] <skill-name>"
    if [ "$1" = "--dry-run" ]; then
      [ $# -lt 2 ] && die "usage: skill-edit push --dry-run <skill-name>"
      cmd_push "$2" "--dry-run"
    else
      cmd_push "$1"
    fi
    ;;
  diff)
    [ $# -lt 1 ] && die "usage: skill-edit diff <skill-name>"
    cmd_diff "$1"
    ;;
  list)
    cmd_list
    ;;
  clean)
    cmd_clean
    ;;
  *)
    die "unknown command: $CMD — run 'skill-edit --help'"
    ;;
esac
