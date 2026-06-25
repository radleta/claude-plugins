#!/bin/bash
# gemini-image — Generate images via Google Gemini API
#
# Calls the Gemini generateContent API directly via curl.
# API key stored at ~/.config/gemini/api-key (owner-only permissions).
#
# Prerequisites: curl, python (3.6+)
#
# Setup:
#   gemini-image init                              # Store API key (interactive)
#   gemini-image init YOUR_KEY                     # Store API key (inline)
#
# Usage:
#   gemini-image "a fox in snow"                   # Generate image (default: output.png)
#   gemini-image "a fox in snow" -o fox.png        # Custom output path
#   gemini-image "a fox in snow" -a 16:9           # Landscape aspect ratio
#   gemini-image "a fox in snow" -s 2K             # Higher resolution
#   gemini-image "a fox in snow" -m flash          # Use faster/cheaper model
#   gemini-image "a fox in snow" -a 16:9 -s 2K    # Combine options
#
# Reference images (up to 14 with pro model):
#   gemini-image "make the background a beach" -i photo.jpg
#   gemini-image "combine these styles" -i style.png -i content.jpg
#   gemini-image "edit this image" -i input.png -o edited.png
#
# Models:
#   pro (default)    gemini-3-pro-image-preview   Higher quality, ~$0.13/image, 4K, up to 14 ref images
#   flash            gemini-2.5-flash-image       Fast, ~$0.04/image
#
# Aspect Ratios:
#   1:1 (default), 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9
#
# Image Sizes:
#   1K (default), 2K, 4K (4K requires pro model)
#
# Supported input formats: PNG, JPEG, WebP, GIF
#
# API Reference:
#   https://ai.google.dev/gemini-api/docs/image-generation
# ---

set -euo pipefail

KEY_FILE="$HOME/.config/gemini/api-key"
API_BASE="https://generativelanguage.googleapis.com/v1beta/models"
PROG="$(basename "$0")"

# --- help ---
show_help() {
  cat <<EOF
Usage: $PROG <prompt> [options]
       $PROG init [API_KEY]

Generate images via the Google Gemini API.

Commands:
  init [KEY]          Store API key (interactive if KEY omitted)

Options:
  -o, --output PATH   Output file path (default: output.png)
  -a, --aspect RATIO  Aspect ratio (default: 1:1)
                      Valid: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9
  -s, --size SIZE     Image size (default: 1K)
                      Valid: 1K, 2K, 4K (4K requires pro model)
  -m, --model MODEL   Model alias or ID (default: pro)
                      Aliases: pro (gemini-3-pro-image-preview)
                               flash (gemini-2.5-flash-image)
  -i, --input FILE    Reference image (repeatable, up to 14 with pro)
  -n, --dry-run       Show what would be sent without calling the API
  -h, --help          Show this help

Examples:
  $PROG "a fox in snow"                          # Basic generation
  $PROG "a fox in snow" -a 16:9 -s 2K -o fox.png # Landscape, high-res
  $PROG "change sky to sunset" -i photo.jpg      # Edit with reference
  $PROG "combine styles" -i a.png -i b.jpg       # Multiple references

Prerequisites:
  curl      HTTP client for API calls
  python    Python 3.6+ for JSON/base64 handling
EOF
}

# --- prerequisite checks ---
check_prereqs() {
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v python >/dev/null 2>&1 || missing+=("python")

  if [ ${#missing[@]} -gt 0 ]; then
    echo "Error: Missing required tools: ${missing[*]}" >&2
    echo "" >&2
    for tool in "${missing[@]}"; do
      case "$tool" in
        curl)   echo "  curl:   Install via your package manager (apt, brew, pacman, etc.)" >&2 ;;
        python) echo "  python: Install Python 3.6+ from https://python.org" >&2 ;;
      esac
    done
    exit 1
  fi
}

# --- init: store the API key ---
if [ "${1:-}" = "init" ]; then
  check_prereqs
  mkdir -p "$(dirname "$KEY_FILE")"
  if [ -n "${2:-}" ]; then
    printf '%s' "$2" > "$KEY_FILE"
  else
    read -s -p "Paste your Gemini API key: " key
    echo
    if [ -z "$key" ]; then
      echo "Error: No key provided." >&2
      exit 1
    fi
    printf '%s' "$key" > "$KEY_FILE"
  fi
  chmod 600 "$KEY_FILE"
  echo "API key saved to $KEY_FILE"
  exit 0
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ -z "${1:-}" ]; then
  show_help
  exit 0
fi

# --- check prerequisites before any real work ---
check_prereqs

# --- require key ---
if [ ! -f "$KEY_FILE" ]; then
  echo "Error: No API key found at $KEY_FILE" >&2
  echo "Run: $PROG init" >&2
  exit 1
fi

API_KEY=$(tr -d '[:space:]' < "$KEY_FILE")

# --- parse arguments ---
PROMPT="$1"
shift

OUTPUT="output.png"
ASPECT="1:1"
SIZE="1K"
MODEL_ALIAS="pro"
DRY_RUN=false
INPUT_IMAGES=()

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output|-a|--aspect|-s|--size|-m|--model|-i|--input)
      [ $# -lt 2 ] && echo "Error: $1 requires a value" >&2 && exit 1
      ;;&
    -o|--output)  OUTPUT="$2"; shift 2 ;;
    -a|--aspect)  ASPECT="$2"; shift 2 ;;
    -s|--size)    SIZE="$2"; shift 2 ;;
    -m|--model)   MODEL_ALIAS="$2"; shift 2 ;;
    -i|--input)   INPUT_IMAGES+=("$2"); shift 2 ;;
    -n|--dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- resolve model ---
case "$MODEL_ALIAS" in
  flash)  MODEL="gemini-2.5-flash-image" ;;
  pro)    MODEL="gemini-3-pro-image-preview" ;;
  *)      MODEL="$MODEL_ALIAS" ;;  # allow raw model ID
esac

# --- validate aspect ratio ---
case "$ASPECT" in
  1:1|16:9|9:16|4:3|3:4|3:2|2:3|5:4|4:5|21:9) ;;
  *) echo "Error: Invalid aspect ratio '$ASPECT'. Valid: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9" >&2; exit 1 ;;
esac

# --- validate size ---
case "$SIZE" in
  1K|2K|4K) ;;
  *) echo "Error: Invalid size '$SIZE'. Valid: 1K, 2K, 4K" >&2; exit 1 ;;
esac

# --- validate input images exist ---
for img in "${INPUT_IMAGES[@]+"${INPUT_IMAGES[@]}"}"; do
  if [ -n "$img" ] && [ ! -f "$img" ]; then
    echo "Error: Input file not found: $img" >&2
    exit 1
  fi
done

# --- dry-run: show config and exit ---
if [ "$DRY_RUN" = true ]; then
  IMG_COUNT=${#INPUT_IMAGES[@]}
  echo "=== Dry Run ==="
  echo "Model:        $MODEL ($MODEL_ALIAS)"
  echo "Prompt:       $PROMPT"
  echo "Aspect Ratio: $ASPECT"
  echo "Size:         $SIZE"
  echo "Output:       $OUTPUT"
  echo "References:   $IMG_COUNT"
  for img in "${INPUT_IMAGES[@]+"${INPUT_IMAGES[@]}"}"; do
    [ -n "$img" ] && echo "  - $img ($(du -h "$img" | cut -f1))"
  done
  echo "API Endpoint: ${API_BASE}/${MODEL}:generateContent"
  echo "API Key:      $(echo "$API_KEY" | head -c4)...$(echo "$API_KEY" | tail -c5)"
  echo "==============="
  exit 0
fi

# --- temp files for large payloads (base64 images can exceed arg limits) ---
TMPDIR=$(mktemp -d)
trap "rm -rf \"$TMPDIR\"" EXIT
REQUEST_FILE="$TMPDIR/request.json"
RESPONSE_FILE="$TMPDIR/response.json"

# --- build request JSON via python (handles escaping + base64 encoding) ---
python -c "
import sys, json, base64, os

prompt = sys.argv[1]
aspect = sys.argv[2]
size = sys.argv[3]
out_file = sys.argv[4]
image_paths = sys.argv[5:]

parts = [{'text': prompt}]

for path in image_paths:
    if not os.path.isfile(path):
        print(f'Error: File not found: {path}', file=sys.stderr)
        sys.exit(1)
    ext = os.path.splitext(path)[1].lower()
    mime_map = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'}
    mime = mime_map.get(ext, 'image/png')
    with open(path, 'rb') as f:
        data = base64.b64encode(f.read()).decode('ascii')
    parts.append({'inline_data': {'mime_type': mime, 'data': data}})

request = {
    'contents': [{'parts': parts}],
    'generationConfig': {
        'responseModalities': ['TEXT', 'IMAGE'],
        'imageConfig': {
            'aspectRatio': aspect,
            'imageSize': size
        }
    }
}

with open(out_file, 'w') as f:
    json.dump(request, f)
" "$PROMPT" "$ASPECT" "$SIZE" "$REQUEST_FILE" "${INPUT_IMAGES[@]+"${INPUT_IMAGES[@]}"}"

# --- call API ---
IMG_COUNT=${#INPUT_IMAGES[@]}
if [ "$IMG_COUNT" -gt 0 ]; then
  echo "Generating image with $MODEL (${ASPECT}, ${SIZE}, ${IMG_COUNT} reference image(s))..." >&2
else
  echo "Generating image with $MODEL (${ASPECT}, ${SIZE})..." >&2
fi

HTTP_CODE=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
  "${API_BASE}/${MODEL}:generateContent?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "@${REQUEST_FILE}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: API returned HTTP $HTTP_CODE" >&2
  python -m json.tool "$RESPONSE_FILE" >&2 2>/dev/null || cat "$RESPONSE_FILE" >&2
  exit 1
fi

# --- extract and save image ---
python -c "
import sys, json, base64, os

with open(sys.argv[1]) as f:
    data = json.load(f)

output = sys.argv[2]

if 'error' in data:
    print(f\"API Error: {data['error'].get('message', data['error'])}\", file=sys.stderr)
    sys.exit(1)

parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
text_parts = [p['text'] for p in parts if 'text' in p]
image_parts = [p for p in parts if 'inlineData' in p]

if not image_parts:
    print('Error: No image in response', file=sys.stderr)
    if text_parts:
        print(f'Model said: {text_parts[0]}', file=sys.stderr)
    sys.exit(1)

img_data = base64.b64decode(image_parts[0]['inlineData']['data'])
with open(output, 'wb') as f:
    f.write(img_data)

size_kb = len(img_data) / 1024
print(f'{output} ({size_kb:.0f} KB)', file=sys.stderr)

if text_parts:
    for t in text_parts:
        if t.strip():
            print(t, file=sys.stderr)
" "$RESPONSE_FILE" "$OUTPUT"
