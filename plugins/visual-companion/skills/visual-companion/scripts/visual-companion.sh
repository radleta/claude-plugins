#!/usr/bin/env bash
# visual-companion — Manage visual companion servers for Claude Code
#
# Usage:
#   visual-companion start <screen_dir>   Start server, block until ready, print URL
#   visual-companion stop [name|--all]    Stop server, block until process exits
#   visual-companion restart              Stop + start with same screen_dir
#   visual-companion url [file]           Print URL for running instance (optionally with file path)
#   visual-companion status               List all running instances
#   visual-companion help                 Show this help

set -euo pipefail

# --- Resolve script directory through symlinks (MSYS-safe) ---

_resolve_script() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SCRIPT_DIR="$(_resolve_script)"

# --- Constants ---

REGISTRY_DIR="$HOME/.claude/visual-companion"
JUST_ONE_NAME="visual-companion"

# --- Helper functions ---

# Derive instance name from a directory path.
# Uses basename, appends short hash if collision would occur.
instance_name_for_dir() {
  local dir="$1"
  local name
  name="$(basename "$dir")"
  # If a registry entry exists with this name but for a different dir, append hash
  local reg_file="$REGISTRY_DIR/$name.json"
  if [[ -f "$reg_file" ]]; then
    local existing_dir
    existing_dir="$(grep -o '"project_dir":"[^"]*"' "$reg_file" | cut -d'"' -f4)" || true
    if [[ -n "$existing_dir" && "$existing_dir" != "$dir" ]]; then
      local hash
      hash="$(printf '%s' "$dir" | cksum | cut -d' ' -f1)"
      name="${name}-${hash:0:6}"
    fi
  fi
  echo "$name"
}

# Write registry file atomically (temp then rename)
write_registry() {
  local name="$1" pid="$2" port="$3" url="$4" screen_dir="$5" project_dir="$6"
  mkdir -p "$REGISTRY_DIR"
  local tmp_file="$REGISTRY_DIR/.tmp-$name"
  local reg_file="$REGISTRY_DIR/$name.json"
  local started
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Use printf with %s to avoid shell injection from directory names containing quotes
  printf '{"name":"%s","pid":%s,"port":%s,"url":"%s","screen_dir":"%s","project_dir":"%s","started":"%s"}\n' \
    "$name" "$pid" "$port" "$url" "$screen_dir" "$project_dir" "$started" > "$tmp_file"
  mv "$tmp_file" "$reg_file"
}

# Check if a visual-companion instance is alive in a given project directory.
# Uses just-one -s from the project dir (works on Windows where kill -0 fails for native PIDs).
instance_alive() {
  local project_dir="$1"
  (cd "$project_dir" 2>/dev/null && just-one -s "$JUST_ONE_NAME" -q 2>/dev/null)
}

# Read a field from a JSON registry file (simple grep-based, no jq dependency)
json_field() {
  local file="$1" field="$2"
  grep -o "\"$field\":[^,}]*" "$file" | head -1 | sed 's/^"[^"]*":\s*//' | tr -d '"'
}

# --- Subcommand: start ---

cmd_start() {
  local screen_dir="${1:-}"

  if [[ -z "$screen_dir" ]]; then
    echo '{"error": "Usage: visual-companion start <screen_dir>"}' >&2
    exit 1
  fi

  # Guard: refuse to start from $HOME
  local cwd
  cwd="$(pwd)"
  local home_resolved
  home_resolved="$(cd "$HOME" && pwd)"
  if [[ "$cwd" == "$home_resolved" ]]; then
    echo '{"error": "Refusing to start from home directory. Run from a project directory instead."}' >&2
    exit 1
  fi

  # Verify just-one is available
  if ! command -v just-one &>/dev/null; then
    echo '{"error": "just-one not found. Install with: npm install -g @radleta/just-one"}' >&2
    exit 1
  fi

  # Check if already running for this project
  local inst_name
  inst_name="$(instance_name_for_dir "$cwd")"
  local reg_file="$REGISTRY_DIR/$inst_name.json"

  if [[ -f "$reg_file" ]]; then
    if instance_alive "$cwd"; then
      # Already running — output existing info
      cat "$reg_file"
      exit 0
    else
      # Stale entry — clean up
      rm -f "$reg_file"
    fi
  fi

  # Create screen_dir if needed
  mkdir -p "$screen_dir"

  # Resolve screen_dir to absolute path
  local abs_screen_dir
  abs_screen_dir="$(cd "$screen_dir" && pwd)"

  # Launch server via just-one from current working directory
  export BRAINSTORM_DIR="$abs_screen_dir"

  # Port reuse: try the last known port from .server-info
  local info_file="$abs_screen_dir/.server-info"
  local preferred_port="0"
  if [[ -f "$info_file" ]]; then
    preferred_port="$(json_field "$info_file" "port" 2>/dev/null || echo "0")"
  fi
  export BRAINSTORM_PREFERRED_PORT="$preferred_port"

  # Remove stale server-info so the wait loop only finds the new one
  rm -f "$info_file"

  just-one -n "$JUST_ONE_NAME" -D -- node "$SCRIPT_DIR/server.cjs"

  # Block until /_ready responds (poll .server-info first for port, then HTTP)
  local waited=0
  while [[ $waited -lt 50 ]]; do
    if [[ -f "$info_file" ]]; then
      local port url pid
      port="$(json_field "$info_file" "port")"
      url="$(json_field "$info_file" "url")"
      pid="$(json_field "$info_file" "pid" 2>/dev/null || echo "0")"

      # Poll /_ready to confirm server is fully up
      local ready_waited=0
      while [[ $ready_waited -lt 30 ]]; do
        if curl -sf "http://localhost:$port/_ready" > /dev/null 2>&1; then
          write_registry "$inst_name" "$pid" "$port" "$url" "$abs_screen_dir" "$cwd"
          echo "$url"
          exit 0
        fi
        sleep 0.1
        ready_waited=$((ready_waited + 1))
      done

      # server-info exists but /_ready never responded
      echo "ERROR: Server wrote .server-info but /_ready not responding" >&2
      echo "Check logs: just-one -L visual-companion" >&2
      exit 1
    fi
    sleep 0.1
    waited=$((waited + 1))
  done

  # Server didn't start
  if ! just-one -s "$JUST_ONE_NAME" -q 2>/dev/null; then
    echo "ERROR: Server process exited. Check logs: just-one -L visual-companion" >&2
    exit 1
  fi

  echo "ERROR: Server failed to start within 5 seconds. Check logs: just-one -L visual-companion" >&2
  exit 1
}

# --- Subcommand: stop ---

# Wait for a just-one process to fully exit (up to 5 seconds)
wait_for_exit() {
  local project_dir="$1"
  local waited=0
  while [[ $waited -lt 50 ]]; do
    if ! (cd "$project_dir" 2>/dev/null && just-one -s "$JUST_ONE_NAME" -q 2>/dev/null); then
      return 0
    fi
    sleep 0.1
    waited=$((waited + 1))
  done
  # Force kill as fallback
  (cd "$project_dir" 2>/dev/null && just-one -k "$JUST_ONE_NAME" -9 2>/dev/null) || true
  return 0
}

cmd_stop() {
  local target="${1:-}"

  if [[ "$target" == "--all" ]]; then
    # Stop all instances
    mkdir -p "$REGISTRY_DIR"
    local count=0
    for reg_file in "$REGISTRY_DIR"/*.json; do
      [[ -f "$reg_file" ]] || continue
      local name project_dir
      name="$(json_field "$reg_file" "name")"
      project_dir="$(json_field "$reg_file" "project_dir")"

      if instance_alive "$project_dir"; then
        (cd "$project_dir" 2>/dev/null && just-one -k "$JUST_ONE_NAME" 2>/dev/null) || true
        wait_for_exit "$project_dir"
      fi
      rm -f "$reg_file"
      count=$((count + 1))
    done
    echo "Stopped $count instance(s)"
    return
  fi

  if [[ -n "$target" ]]; then
    # Stop named instance
    local reg_file="$REGISTRY_DIR/$target.json"
    if [[ ! -f "$reg_file" ]]; then
      echo "ERROR: Instance '$target' not found" >&2
      exit 1
    fi
    local project_dir
    project_dir="$(json_field "$reg_file" "project_dir")"
    if instance_alive "$project_dir"; then
      (cd "$project_dir" 2>/dev/null && just-one -k "$JUST_ONE_NAME" 2>/dev/null) || true
      wait_for_exit "$project_dir"
    fi
    rm -f "$reg_file"
    echo "Stopped"
    return
  fi

  # Stop current project's instance
  local cwd
  cwd="$(pwd)"
  local inst_name
  inst_name="$(instance_name_for_dir "$cwd")"
  local reg_file="$REGISTRY_DIR/$inst_name.json"

  if [[ -f "$reg_file" ]]; then
    if instance_alive "$cwd"; then
      just-one -k "$JUST_ONE_NAME" 2>/dev/null || true
      wait_for_exit "$cwd"
    fi
    rm -f "$reg_file"
    echo "Stopped"
  else
    # Try just-one directly from current dir
    if just-one -s "$JUST_ONE_NAME" -q 2>/dev/null; then
      just-one -k "$JUST_ONE_NAME" 2>/dev/null || true
      wait_for_exit "$cwd"
      echo "Stopped"
    else
      echo "Not running"
    fi
  fi
}

# --- Subcommand: restart ---

cmd_restart() {
  local cwd
  cwd="$(pwd)"
  local inst_name
  inst_name="$(instance_name_for_dir "$cwd")"
  local reg_file="$REGISTRY_DIR/$inst_name.json"

  # Get screen_dir from registry (so user doesn't have to re-specify it)
  local screen_dir=""
  if [[ -f "$reg_file" ]]; then
    screen_dir="$(json_field "$reg_file" "screen_dir")"
  fi

  if [[ -z "$screen_dir" ]]; then
    echo "ERROR: No running instance found for this project. Use 'visual-companion start <screen_dir>' instead." >&2
    exit 1
  fi

  # Stop (blocking)
  cmd_stop ""

  # Start with the same screen_dir
  cmd_start "$screen_dir"
}

# --- Subcommand: url ---

cmd_url() {
  local file="${1:-}"
  local cwd
  cwd="$(pwd)"
  local inst_name
  inst_name="$(instance_name_for_dir "$cwd")"
  local reg_file="$REGISTRY_DIR/$inst_name.json"

  if [[ ! -f "$reg_file" ]]; then
    echo "ERROR: No running instance found for this project" >&2
    exit 1
  fi

  if ! instance_alive "$cwd"; then
    rm -f "$reg_file"
    echo "ERROR: Instance is no longer running" >&2
    exit 1
  fi

  local url
  url="$(json_field "$reg_file" "url")"

  if [[ -n "$file" ]]; then
    echo "${url}/${file}"
  else
    echo "$url"
  fi
}

# --- Subcommand: status ---

cmd_status() {
  mkdir -p "$REGISTRY_DIR"
  local found=0

  printf "%-20s %-7s %-40s %s\n" "INSTANCE" "PORT" "DIR" "STARTED"
  printf "%-20s %-7s %-40s %s\n" "--------" "----" "---" "-------"

  for reg_file in "$REGISTRY_DIR"/*.json; do
    [[ -f "$reg_file" ]] || continue
    local name pid port project_dir started
    name="$(json_field "$reg_file" "name")"
    pid="$(json_field "$reg_file" "pid")"
    port="$(json_field "$reg_file" "port")"
    project_dir="$(json_field "$reg_file" "project_dir")"
    started="$(json_field "$reg_file" "started")"

    if instance_alive "$project_dir"; then
      printf "%-20s %-7s %-40s %s\n" "$name" "$port" "$project_dir" "$started"
      found=$((found + 1))
    else
      # Stale entry — clean up
      rm -f "$reg_file"
    fi
  done

  if [[ $found -eq 0 ]]; then
    echo "(no running instances)"
  fi
}

# --- Subcommand: help ---

cmd_help() {
  cat <<'HELP'
visual-companion — Manage visual companion servers for Claude Code

Usage:
  visual-companion start <screen_dir>   Start server, block until ready, print URL
  visual-companion stop [name|--all]    Stop server, block until process exits
  visual-companion restart              Stop + start with same screen_dir (remembered)
  visual-companion url [file]           Print URL for running instance
  visual-companion status               List all running instances
  visual-companion help                 Show this help

Start blocks until the server responds to /_ready, then prints the URL.
Stop blocks until the process fully exits. Restart remembers the screen_dir.
Port is reused across restarts (saved in .server-info).

Examples:
  visual-companion start .brainstorm/       Start serving .brainstorm/ dir
  visual-companion restart                  Restart with same dir, same port
  visual-companion url test-plan.md         Print URL for a specific file
  visual-companion status                   List all running servers
  visual-companion stop                     Stop current project's server
  visual-companion stop --all               Stop all instances

Requires: just-one (npm install -g @radleta/just-one), node, curl
HELP
}

# --- Main dispatch ---

case "${1:-}" in
  -h|--help|help)
    cmd_help
    ;;
  start)
    shift
    cmd_start "$@"
    ;;
  stop)
    shift
    cmd_stop "${1:-}"
    ;;
  restart)
    cmd_restart
    ;;
  url)
    shift
    cmd_url "${1:-}"
    ;;
  status)
    cmd_status
    ;;
  "")
    echo "ERROR: no subcommand provided" >&2
    echo "Usage: visual-companion start|stop|restart|url|status|help" >&2
    exit 1
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    echo "Usage: visual-companion start|stop|restart|url|status|help" >&2
    exit 1
    ;;
  *)
    echo "ERROR: unknown subcommand: $1" >&2
    echo "Usage: visual-companion start|stop|restart|url|status|help" >&2
    exit 1
    ;;
esac
