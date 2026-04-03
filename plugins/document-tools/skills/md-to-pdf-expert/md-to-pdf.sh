#!/usr/bin/env bash
# Generate branded PDF from Markdown using named templates.
#
# Usage:
#   md-to-pdf input.md                              # Default template (clean)
#   md-to-pdf input.md -t akn                       # AKN branded template
#   md-to-pdf input.md -t akn --cover               # With branded cover page
#   md-to-pdf input.md -t akn --cover --toc         # Cover + table of contents
#   md-to-pdf input.md -t akn --cover --confidential  # Cover + confidential marking
#   md-to-pdf input.md --title "My Doc"             # Override title (default: first H1)
#   md-to-pdf input.md --subtitle "For Client X"    # Subtitle on cover page
#   md-to-pdf input.md --numbered                   # Numbered sections
#   md-to-pdf input.md --logo my-logo.png           # Custom logo on cover
#   md-to-pdf input.md -o output.pdf                # Custom output path
#
# Templates live in: ~/.claude/skills/md-to-pdf-expert/templates/<name>/
# Each template folder contains: template.tex + optional assets (logos, fonts)
#
# Requirements: pandoc (3.0+), xelatex (TeX Live)

set -euo pipefail

# Resolve through symlinks (works on MSYS2/Git Bash where readlink -f may not follow symlinks)
_resolve_script() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SKILL_DIR="$(_resolve_script)"
TEMPLATES_DIR="$SKILL_DIR/templates"

# ── Dependency check ─────────────────────────────────────────────
check_deps() {
  local missing=()
  command -v pandoc >/dev/null 2>&1 || missing+=("pandoc")
  command -v xelatex >/dev/null 2>&1 || missing+=("xelatex (TeX Live)")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: Missing required dependencies:" >&2
    for dep in "${missing[@]}"; do
      echo "  - $dep" >&2
    done
    echo "" >&2
    echo "Install instructions:" >&2
    echo "  pandoc:   https://pandoc.org/installing.html" >&2
    echo "            winget install pandoc  (Windows)" >&2
    echo "            brew install pandoc    (macOS)" >&2
    echo "  xelatex:  https://tug.org/texlive/" >&2
    echo "            Install TeX Live (includes xelatex)" >&2
    exit 1
  fi
}

# ── Defaults ─────────────────────────────────────────────────────
INPUT=""
OUTPUT=""
TEMPLATE_NAME=""
TITLE=""
SUBTITLE=""
AUTHOR=""
EMAIL=""
DATE=""
LOGO=""
COVER=false
TOC=false
CONFIDENTIAL=false
NUMBERED=false

# ── Parse args ───────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)       OUTPUT="$2"; shift 2 ;;
    -t|--template)     TEMPLATE_NAME="$2"; shift 2 ;;
    --title)           TITLE="$2"; shift 2 ;;
    --subtitle)        SUBTITLE="$2"; shift 2 ;;
    --author)          AUTHOR="$2"; shift 2 ;;
    --email)           EMAIL="$2"; shift 2 ;;
    --date)            DATE="$2"; shift 2 ;;
    --logo)            LOGO="$2"; shift 2 ;;
    --cover)           COVER=true; shift ;;
    --toc)             TOC=true; shift ;;
    --confidential)    CONFIDENTIAL=true; shift ;;
    --numbered)        NUMBERED=true; shift ;;
    --list-templates)
      echo "Available templates:"
      for d in "$TEMPLATES_DIR"/*/; do
        name="$(basename "$d")"
        echo "  $name"
      done
      exit 0
      ;;
    -h|--help)
      head -16 "$0" | tail -14
      echo ""
      echo "Available templates:"
      for d in "$TEMPLATES_DIR"/*/; do
        echo "  $(basename "$d")"
      done
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$INPUT" ]]; then
        INPUT="$1"; shift
      else
        echo "Unexpected argument: $1" >&2; exit 1
      fi
      ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "Usage: md-to-pdf <input.md> [options]" >&2
  echo "Run md-to-pdf --help for options." >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "File not found: $INPUT" >&2; exit 1
fi

check_deps

# ── Resolve paths ────────────────────────────────────────────────
INPUT_DIR="$(cd "$(dirname "$INPUT")" && pwd)"
INPUT_NAME="$(basename "$INPUT" .md)"

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$INPUT_DIR/$INPUT_NAME.pdf"
fi

# Auto-detect title from first H1 if not provided
if [[ -z "$TITLE" ]]; then
  TITLE="$(head -20 "$INPUT" | grep -m1 '^# ' | sed 's/^# //' || echo "$INPUT_NAME")"
fi

# Default date
if [[ -z "$DATE" ]]; then
  DATE="$(date +'%B %Y')"
fi

# ── Resolve template ─────────────────────────────────────────────
TEMPLATE_TEX=""
TEMPLATE_RESOURCE_PATH=""

if [[ -n "$TEMPLATE_NAME" ]]; then
  TEMPLATE_DIR="$TEMPLATES_DIR/$TEMPLATE_NAME"
  if [[ ! -d "$TEMPLATE_DIR" ]]; then
    echo "Template not found: $TEMPLATE_NAME" >&2
    echo "Available templates:" >&2
    for d in "$TEMPLATES_DIR"/*/; do
      echo "  $(basename "$d")" >&2
    done
    exit 1
  fi
  TEMPLATE_TEX="$TEMPLATE_DIR/template.tex"
  if [[ ! -f "$TEMPLATE_TEX" ]]; then
    echo "Template missing template.tex: $TEMPLATE_DIR" >&2; exit 1
  fi
  TEMPLATE_RESOURCE_PATH="$TEMPLATE_DIR"

  # Auto-detect logo from template directory if not specified via --logo
  if [[ -z "$LOGO" ]]; then
    for img in "$TEMPLATE_DIR"/*.png "$TEMPLATE_DIR"/*.jpg "$TEMPLATE_DIR"/*.pdf; do
      if [[ -f "$img" && "$(basename "$img")" == *logo* ]]; then
        LOGO="$img"
        break
      fi
    done
  fi
fi

# ── Build pandoc args ────────────────────────────────────────────
ARGS=(
  "$INPUT"
  -o "$OUTPUT"
  --pdf-engine=xelatex
  --metadata title="$TITLE"
  --metadata date="$DATE"
)

# Template or fallback to clean pandoc defaults
if [[ -n "$TEMPLATE_TEX" ]]; then
  ARGS+=(--template="$TEMPLATE_TEX")
  # Windows pandoc uses ';' as path separator, Unix uses ':'
  if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || "$OSTYPE" == win* ]]; then
    ARGS+=(--resource-path="$INPUT_DIR;$TEMPLATE_RESOURCE_PATH")
  else
    ARGS+=(--resource-path="$INPUT_DIR:$TEMPLATE_RESOURCE_PATH")
  fi
else
  # Clean defaults without a template
  ARGS+=(
    --resource-path="$INPUT_DIR"
    -V geometry:margin=0.8in
    -V mainfont="Segoe UI"
    -V fontsize=10pt
    -V colorlinks=true
    -V linkcolor=blue
    -V urlcolor=blue
  )
fi

$COVER         && ARGS+=(--metadata cover=true)
$TOC           && ARGS+=(--toc --toc-depth=3)
$CONFIDENTIAL  && ARGS+=(--metadata confidential=true)
$NUMBERED      && ARGS+=(--number-sections)

[[ -n "$SUBTITLE" ]] && ARGS+=(--metadata subtitle="$SUBTITLE")
[[ -n "$AUTHOR" ]]   && ARGS+=(--metadata author="$AUTHOR")
[[ -n "$EMAIL" ]]    && ARGS+=(--metadata email="$EMAIL")
# Resolve logo to absolute path for xelatex (runs in temp dir, can't find relative paths)
if [[ -n "$LOGO" && "$LOGO" != /* ]]; then
  LOGO="$(cd "$(dirname "$LOGO")" && pwd)/$(basename "$LOGO")"
fi
[[ -n "$LOGO" ]]     && ARGS+=(--metadata logo="$LOGO")

# ── Generate ─────────────────────────────────────────────────────
echo "Generating: $OUTPUT"
pandoc "${ARGS[@]}"
echo "Done: $OUTPUT"
