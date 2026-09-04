#!/usr/bin/env bash
# visual-companion — Machine-wide singleton server manager for Visual Companion
#
# Usage:
#   visual-companion add <dir>              Register dir, ensure server running, output JSON
#   visual-companion remove <path|hash>     Remove dir from registry (path or hash, not bare name)
#   visual-companion start                  Start singleton server, output JSON
#   visual-companion stop                   Stop server (idempotent)
#   visual-companion list [--json]          List registered projects
#   visual-companion url <dir|hash|name> [file]  Get URL for a project (exit 2 if not running)
#   visual-companion status                 Server status (exit 0=running, 3=not running)
#   visual-companion --help | -h            Show usage
#   visual-companion --version | -v         Show version

set -euo pipefail

VERSION="2.0.0"

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

# --- Config ---

CONFIG_DIR="${VISUAL_COMPANION_CONFIG_DIR:-$HOME/.claude/visual-companion}"
DIRS_JSON="$CONFIG_DIR/dirs.json"
SERVER_INFO="$CONFIG_DIR/.server-info"
JUST_ONE_NAME="visual-companion"

# --- Dependency check ---

check_deps() {
  local missing=()
  for dep in node npx curl; do
    if ! command -v "$dep" &>/dev/null; then
      missing+=("$dep")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: missing required dependencies: ${missing[*]}" >&2
    echo "node, npx, and curl must be on PATH" >&2
    echo "just-one itself is fetched on demand via npx @radleta/just-one" >&2
    exit 2
  fi
}

# --- MSYS path normalization ---

# Convert MSYS /c/Users/... paths to C:/Users/... for consistent hashing
normalize_path() {
  local p="$1"
  # Convert /c/Users/... → C:/Users/...
  if [[ "$p" =~ ^/([a-zA-Z])(/.*)?$ ]]; then
    local drive="${BASH_REMATCH[1]}"
    local rest="${BASH_REMATCH[2]:-}"
    p="${drive^^}:${rest}"
  fi
  echo "$p"
}

# Resolve a path to absolute, then normalize for consistent hashing
resolve_abs_path() {
  local p="$1"
  local abs
  abs="$(cd "$p" 2>/dev/null && pwd)"
  normalize_path "$abs"
}

# --- Hash function ---

project_hash() {
  local abs_path="$1"
  printf '%s' "$abs_path" | sha1sum | cut -c1-8
}

# --- JSON helpers ---

# Extract a simple scalar field from JSON (no jq required)
# Field name is anchored with a leading quote to prevent substring collisions.
json_field() {
  local file="$1" field="$2"
  grep -o "\"${field}\":[^,}]*" "$file" 2>/dev/null | head -1 | sed 's/^"[^"]*":\s*//' | tr -d '"'
}

# Escape a string for safe embedding in a JSON value (escapes \ and ")
json_escape() {
  local s="$1"
  # Escape backslash first, then double-quote
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  echo "$s"
}

# --- dirs.json helpers ---

# Initialize dirs.json if missing
dirs_json_init() {
  mkdir -p "$CONFIG_DIR"
  if [[ ! -f "$DIRS_JSON" ]]; then
    printf '{"projects":{}}\n' > "$DIRS_JSON"
  fi
}

# Add a project entry to dirs.json (atomic write, idempotent by hash)
# Args: hash abs_path name added_iso
dirs_json_add() {
  local hash="$1" abs_path="$2" name="$3" added="$4"
  dirs_json_init

  # Node.js writes to a PID-unique tmp file then renames to DIRS_JSON (single atomic rename).
  # PID-unique name prevents collision when two processes run concurrently.
  node - "$DIRS_JSON" "$hash" "$abs_path" "$name" "$added" "$$" <<'NODEEOF'
const fs = require('fs');
const [,, src, hash, absPath, name, added, pid] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
// Idempotent: if hash already present, leave unchanged
if (!data.projects[hash]) {
  data.projects[hash] = { path: absPath, name, added };
}
const tmp = src + '.tmp.' + pid;
fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
fs.renameSync(tmp, src);
NODEEOF
}

# Remove a project entry from dirs.json by hash (atomic write)
dirs_json_remove() {
  local hash="$1"
  dirs_json_init

  # Anchor hash match to JSON key position ("hash": ...) to avoid substring collisions
  if ! grep -qF "\"${hash}\":" "$DIRS_JSON" 2>/dev/null; then
    return 1  # not found
  fi

  # Node.js writes to a PID-unique tmp file then renames to DIRS_JSON (single atomic rename).
  node - "$DIRS_JSON" "$hash" "$$" <<'NODEEOF'
const fs = require('fs');
const [,, src, removeHash, pid] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
delete data.projects[removeHash];
const tmp = src + '.tmp.' + pid;
fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
fs.renameSync(tmp, src);
NODEEOF
}

# Look up a project by hash in dirs.json
# Outputs: path name  (tab-separated), returns 1 if not found
dirs_json_get_by_hash() {
  local hash="$1"
  dirs_json_init

  node - "$DIRS_JSON" "$hash" <<'NODEEOF'
const fs = require('fs');
const [,, src, hash] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
const entry = data.projects[hash];
if (!entry) { process.exit(1); }
process.stdout.write(entry.path + '\t' + entry.name + '\n');
NODEEOF
}

# Look up a project by absolute path in dirs.json
# Outputs: hash name  (tab-separated), returns 1 if not found
dirs_json_get_by_path() {
  local abs_path="$1"
  dirs_json_init

  node - "$DIRS_JSON" "$abs_path" <<'NODEEOF'
const fs = require('fs');
const [,, src, absPath] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
for (const [hash, entry] of Object.entries(data.projects)) {
  if (entry.path === absPath) {
    process.stdout.write(hash + '\t' + entry.name + '\n');
    process.exit(0);
  }
}
process.exit(1);
NODEEOF
}

# Look up a project by name in dirs.json
# Outputs: hash abs_path  (tab-separated), returns 1 if not found, 2 if ambiguous
dirs_json_get_by_name() {
  local name="$1"
  dirs_json_init

  node - "$DIRS_JSON" "$name" <<'NODEEOF'
const fs = require('fs');
const [,, src, name] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
const matches = [];
for (const [hash, entry] of Object.entries(data.projects)) {
  if (entry.name === name) {
    matches.push({ hash, path: entry.path });
  }
}
if (matches.length === 0) { process.exit(1); }
if (matches.length > 1) { process.exit(2); }
process.stdout.write(matches[0].hash + '\t' + matches[0].path + '\n');
NODEEOF
}

# --- Server info helpers ---

server_info_read() {
  if [[ ! -f "$SERVER_INFO" ]]; then
    return 1
  fi
  cat "$SERVER_INFO"
}

server_info_field() {
  local field="$1"
  if [[ ! -f "$SERVER_INFO" ]]; then
    return 1
  fi
  json_field "$SERVER_INFO" "$field"
}

# --- just-one helpers ---

just_one_cmd() {
  npx @radleta/just-one -n "$JUST_ONE_NAME" -d "$CONFIG_DIR" "$@"
}

# Status/kill helpers — these commands take name as their own argument, not via -n
just_one_is_running() {
  npx @radleta/just-one -s "$JUST_ONE_NAME" -d "$CONFIG_DIR" -q 2>/dev/null
}

just_one_kill() {
  npx @radleta/just-one -k "$JUST_ONE_NAME" -d "$CONFIG_DIR" "$@" 2>/dev/null
}

# --- Poll helpers ---

# Poll for .server-info file (up to 5s, 100ms intervals)
poll_server_info() {
  local waited=0
  while [[ $waited -lt 50 ]]; do
    if [[ -f "$SERVER_INFO" ]]; then
      return 0
    fi
    sleep 0.1
    waited=$((waited + 1))
  done
  return 1
}

# Poll /_ready HTTP endpoint (up to 3s, 100ms intervals)
# Validates port is numeric before constructing URL.
poll_ready() {
  local port="$1"
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "ERROR: invalid port in server-info: '$port'" >&2
    return 1
  fi
  local waited=0
  while [[ $waited -lt 30 ]]; do
    if curl -sf "http://localhost:${port}/_ready" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
    waited=$((waited + 1))
  done
  return 1
}

# Ensure server is running and ready; start if needed
# Sets $RESOLVED_PORT and $RESOLVED_URL on success
ensure_server() {
  # Try -e (ensure) mode: starts only if not already running
  if ! just_one_cmd -e -D -- node "$SCRIPT_DIR/server.cjs" 2>/dev/null; then
    echo "ERROR: just-one failed to start server" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi

  # Wait for .server-info
  if ! poll_server_info; then
    echo "ERROR: server failed to write server-info within 5 seconds" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi

  RESOLVED_PORT="$(server_info_field "port")"
  RESOLVED_URL="$(server_info_field "url")"

  # Poll /_ready
  if ! poll_ready "$RESOLVED_PORT"; then
    echo "ERROR: server started but /_ready not responding within 3 seconds" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi
}

# --- Subcommand: add ---

cmd_add() {
  local dir="${1:-}"
  if [[ -z "$dir" ]]; then
    echo "ERROR: 'add' requires a directory argument" >&2
    echo "Usage: visual-companion add <dir>" >&2
    exit 1
  fi

  if [[ ! -d "$dir" ]]; then
    echo "ERROR: directory not found: $dir" >&2
    exit 1
  fi

  local abs_path
  abs_path="$(resolve_abs_path "$dir")"

  local hash
  hash="$(project_hash "$abs_path")"

  local name
  name="$(basename "$abs_path")"

  local added
  added="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Write to dirs.json (idempotent)
  dirs_json_add "$hash" "$abs_path" "$name" "$added"

  # Ensure server running and ready
  local RESOLVED_PORT RESOLVED_URL
  ensure_server

  local project_url="${RESOLVED_URL}/${hash}"

  # Escape user-derived values before embedding in JSON string literals
  local esc_url esc_name esc_path
  esc_url="$(json_escape "$project_url")"
  esc_name="$(json_escape "$name")"
  esc_path="$(json_escape "$abs_path")"

  printf '{"url":"%s","hash":"%s","name":"%s","path":"%s","shared":true}\n' \
    "$esc_url" "$hash" "$esc_name" "$esc_path"
}

# --- Subcommand: remove ---

cmd_remove() {
  local arg="${1:-}"
  if [[ -z "$arg" ]]; then
    echo "ERROR: 'remove' requires a path or hash argument" >&2
    echo "Usage: visual-companion remove <full-path|hash>" >&2
    exit 1
  fi

  dirs_json_init

  local hash=""
  local display_label=""

  # Determine if arg is a hash (8 hex chars), a path (contains separator), or bare name
  if [[ "$arg" =~ ^[0-9a-f]{8}$ ]]; then
    # Looks like a hash
    hash="$arg"
    display_label="hash $hash"
  elif [[ "$arg" == */* || "$arg" == *\\* ]] || [[ -d "$arg" ]]; then
    # Looks like a path
    local abs_path
    abs_path="$(resolve_abs_path "$arg" 2>/dev/null)" || {
      echo "ERROR: path not found: $arg" >&2
      exit 1
    }
    local lookup_result
    if ! lookup_result="$(dirs_json_get_by_path "$abs_path" 2>/dev/null)"; then
      echo "ERROR: path not registered: $abs_path" >&2
      exit 1
    fi
    hash="$(echo "$lookup_result" | cut -f1)"
    display_label="$abs_path"
  else
    # Bare name — reject
    echo "ERROR: bare names not accepted — use full path or hash" >&2
    echo "Hint: use 'visual-companion list' to see registered paths and hashes" >&2
    exit 1
  fi

  if ! dirs_json_remove "$hash"; then
    echo "ERROR: project not found (hash: $hash)" >&2
    exit 1
  fi

  echo "Removed: $display_label (hash: $hash)"
}

# --- Subcommand: start ---

cmd_start() {
  mkdir -p "$CONFIG_DIR"

  # Only remove server-info if server is not currently running, so a running server's
  # info file is not discarded before the poll loop can read it.
  if ! just_one_is_running; then
    rm -f "$SERVER_INFO"
  fi

  if ! just_one_cmd -e -D -- node "$SCRIPT_DIR/server.cjs" 2>/dev/null; then
    echo "ERROR: just-one failed to start server" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi

  if ! poll_server_info; then
    echo "ERROR: server failed to write server-info within 5 seconds" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi

  local port url pid
  port="$(server_info_field "port")"
  url="$(server_info_field "url")"
  pid="$(server_info_field "pid")"

  if ! poll_ready "$port"; then
    echo "ERROR: server started but /_ready not responding within 3 seconds" >&2
    echo "Check logs: npx @radleta/just-one -L $JUST_ONE_NAME -d $CONFIG_DIR" >&2
    exit 2
  fi

  local esc_url
  esc_url="$(json_escape "$url")"
  # port and pid are numeric from server-info — no escaping needed
  printf '{"url":"%s","port":%s,"pid":%s}\n' "$esc_url" "$port" "$pid"
}

# --- Subcommand: stop ---

cmd_stop() {
  # Idempotent: exit 0 even if not running
  if just_one_is_running; then
    just_one_kill || true
    echo "Stopped"
  else
    echo "Not running"
  fi
}

# --- Subcommand: list ---

cmd_list() {
  local json_mode=0
  if [[ "${1:-}" == "--json" ]]; then
    json_mode=1
  fi

  dirs_json_init

  if [[ $json_mode -eq 1 ]]; then
    node - "$DIRS_JSON" <<'NODEEOF'
const fs = require('fs');
const [,, src] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
const arr = Object.entries(data.projects).map(([hash, e]) => ({
  hash, path: e.path, name: e.name, added: e.added
}));
process.stdout.write(JSON.stringify(arr, null, 2) + '\n');
NODEEOF
  else
    node - "$DIRS_JSON" <<'NODEEOF'
const fs = require('fs');
const [,, src] = process.argv;
const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
const entries = Object.entries(data.projects);
if (entries.length === 0) {
  process.stdout.write('(no registered projects)\n');
  process.exit(0);
}
const hashW = 10, nameW = 24, addedW = 22;
const pad = (s, w) => String(s).substring(0, w).padEnd(w);
process.stdout.write(pad('HASH', hashW) + '  ' + pad('NAME', nameW) + '  ' + pad('ADDED', addedW) + '  PATH\n');
process.stdout.write(pad('----', hashW) + '  ' + pad('----', nameW) + '  ' + pad('-----', addedW) + '  ----\n');
for (const [hash, e] of entries) {
  process.stdout.write(pad(hash, hashW) + '  ' + pad(e.name, nameW) + '  ' + pad(e.added, addedW) + '  ' + e.path + '\n');
}
NODEEOF
  fi
}

# --- Subcommand: url ---

cmd_url() {
  local identifier="${1:-}"
  local file="${2:-}"

  if [[ -z "$identifier" ]]; then
    echo "ERROR: 'url' requires an identifier (path, hash, or name)" >&2
    echo "Usage: visual-companion url <dir|hash|name> [file]" >&2
    exit 1
  fi

  dirs_json_init

  # Server must be running — url is read-only, no auto-start
  if ! just_one_is_running; then
    echo "ERROR: server not running — run 'visual-companion start' or 'visual-companion add <dir>'" >&2
    exit 2
  fi

  local base_url
  base_url="$(server_info_field "url")"
  if [[ -z "$base_url" ]]; then
    echo "ERROR: server-info not found or unreadable" >&2
    exit 2
  fi

  local hash="" name="" abs_path=""

  # Try as 8-char hex hash
  if [[ "$identifier" =~ ^[0-9a-f]{8}$ ]]; then
    local lookup_result
    if lookup_result="$(dirs_json_get_by_hash "$identifier" 2>/dev/null)"; then
      hash="$identifier"
      abs_path="$(echo "$lookup_result" | cut -f1)"
      name="$(echo "$lookup_result" | cut -f2)"
    fi
  fi

  # Try as path (has separator or is an existing directory)
  if [[ -z "$hash" ]]; then
    if [[ "$identifier" == */* || "$identifier" == *\\* ]] || [[ -d "$identifier" ]]; then
      local resolved_path
      if resolved_path="$(resolve_abs_path "$identifier" 2>/dev/null)"; then
        local lookup_result
        if lookup_result="$(dirs_json_get_by_path "$resolved_path" 2>/dev/null)"; then
          hash="$(echo "$lookup_result" | cut -f1)"
          name="$(echo "$lookup_result" | cut -f2)"
          abs_path="$resolved_path"
        fi
      fi
    fi
  fi

  # Try as name
  if [[ -z "$hash" ]]; then
    local lookup_result
    local name_exit=0
    lookup_result="$(dirs_json_get_by_name "$identifier" 2>/dev/null)" || name_exit=$?
    if [[ $name_exit -eq 0 ]]; then
      hash="$(echo "$lookup_result" | cut -f1)"
      abs_path="$(echo "$lookup_result" | cut -f2)"
      name="$identifier"
    elif [[ $name_exit -eq 2 ]]; then
      echo "ERROR: name '$identifier' is ambiguous — multiple projects share this name; use hash or full path" >&2
      exit 1
    fi
  fi

  if [[ -z "$hash" ]]; then
    echo "ERROR: project not found: $identifier" >&2
    exit 1
  fi

  local project_url="${base_url}/${hash}"
  if [[ -n "$file" ]]; then
    project_url="${project_url}/${file}"
  fi

  local esc_url esc_name
  esc_url="$(json_escape "$project_url")"
  esc_name="$(json_escape "$name")"
  printf '{"url":"%s","hash":"%s","name":"%s"}\n' "$esc_url" "$hash" "$esc_name"
}

# --- Subcommand: status ---

cmd_status() {
  if just_one_is_running; then
    # Running — try to read server-info for details
    if [[ -f "$SERVER_INFO" ]]; then
      local port pid url
      port="$(server_info_field "port")"
      pid="$(server_info_field "pid")"
      url="$(server_info_field "url")"
      echo "running  pid=$pid  port=$port  url=$url"
    else
      echo "running  (server-info not found)"
    fi
    exit 0
  else
    echo "not running"
    exit 3
  fi
}

# --- Help ---

cmd_help() {
  cat <<'HELP'
visual-companion — Machine-wide singleton server manager for Visual Companion

Usage:
  visual-companion add <dir>               Register dir, ensure server running, output JSON
  visual-companion remove <path|hash>      Remove dir from registry (path or hash, NOT bare name)
  visual-companion start                   Start singleton server, output JSON with url/port/pid
  visual-companion stop                    Stop server (idempotent — exit 0 if not running)
  visual-companion list [--json]           List registered projects
  visual-companion url <dir|hash|name> [file]  Get URL for a project (exit 2 if not running)
  visual-companion status                  Server status (exit 0=running, exit 3=not running)
  visual-companion --help | -h             Show this help
  visual-companion --version | -v          Show version

Exit codes:
  0   Success
  1   User error (bad args, not found, bare name rejected)
  2   Infrastructure error (server unreachable, just-one failure, server-info missing)
  3   Not running (status command only)
  130 Ctrl+C

JSON output commands: add, start, url (always JSON)
                      list (JSON with --json flag)

Config directory:
  Default: ~/.claude/visual-companion/
  Override: VISUAL_COMPANION_CONFIG_DIR=<path>

Requires: node, npx, curl (just-one is fetched on demand via npx @radleta/just-one)

Examples:
  visual-companion add scratch/my-feature/   Register dir, start server, get URL
  visual-companion list                       Show all registered projects
  visual-companion list --json                JSON array of projects
  visual-companion url my-feature plan.md     URL for a file in a named project
  visual-companion remove a1b2c3d4            Remove by hash
  visual-companion status                     Check if server is running
  visual-companion stop                       Kill server
HELP
}

# --- Signal handling and cleanup ---

# Clean up any PID-unique tmp files left behind if script exits unexpectedly
_cleanup_tmp() {
  rm -f "$CONFIG_DIR/dirs.json.tmp.$$" 2>/dev/null || true
}
trap '_cleanup_tmp' EXIT
trap 'exit 130' INT

# --- Main dispatch ---

# Global flags parsed before subcommand
case "${1:-}" in
  --help|-h)
    cmd_help
    exit 0
    ;;
  --version|-v)
    echo "visual-companion $VERSION"
    exit 0
    ;;
esac

# Dependency check before any subcommand
check_deps

case "${1:-}" in
  add)
    shift
    cmd_add "${1:-}"
    ;;
  remove)
    shift
    cmd_remove "${1:-}"
    ;;
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  list)
    shift
    cmd_list "${1:-}"
    ;;
  url)
    shift
    cmd_url "${1:-}" "${2:-}"
    ;;
  status)
    cmd_status
    ;;
  "")
    echo "ERROR: no subcommand provided" >&2
    echo "Usage: visual-companion add|remove|start|stop|list|url|status|--help|--version" >&2
    exit 1
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    echo "Usage: visual-companion add|remove|start|stop|list|url|status|--help|--version" >&2
    exit 1
    ;;
  *)
    echo "ERROR: unknown subcommand: $1" >&2
    echo "Usage: visual-companion add|remove|start|stop|list|url|status|--help|--version" >&2
    exit 1
    ;;
esac
