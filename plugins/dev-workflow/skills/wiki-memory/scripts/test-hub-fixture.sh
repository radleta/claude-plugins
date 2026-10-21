#!/usr/bin/env bash
# test-hub-fixture.sh — the one hub fixture domain both test-wiki-write.sh and
# test-wiki-health.sh build from, so wiki-write's and wiki-health's readings
# of the grouped-page listing convention are tested against the same files.
# Sourced, never run.
#
# _hub_fixture <skills-root> <domain> <part>...
# Writes a fenced, wiki-declared domain holding every part named:
#   akn   SKILL.md over 60,000 bytes listing grouped leaves (the akn-expert
#         shape): hub grpA/index.md lists r and x; SKILL.md lists q, r and
#         300 filler leaves l001..l300 directly. Also hub grpB/index.md (empty
#         list) and root page y.
#   grpF  grpF/a and grpF/b listed in SKILL.md, no grpF hub bullet.
#   grpG  grpG/w listed nowhere; grpG/index.md lists nothing.
#   grpH  grpH/p listed in SKILL.md; no grpH/index.md.
#   grpJ  grpJ/index.md with no '## Pages' heading; grpJ/r listed nowhere.
#   grpE  grpE/y with no grpE/index.md, listed nowhere.
#   grpK  grpK/z, the only page in grpK/, no grpK/index.md, listed nowhere.

# _hub_page <file> <summary> [body]
_hub_page() {
  mkdir -p "$(dirname "$1")"
  printf -- '---\ntags: [hub-expert/page]\nsummary: "%s"\n---\n# %s\n\n%s\n' "$2" "$(basename "$1" .md)" "${3:-Body.}" > "$1"
}

# _hub_index <file> <summary> [bullet...] — a group index with a '## Pages' list.
_hub_index() {
  local f="$1" s="$2"; shift 2
  local list=""
  [[ $# -gt 0 ]] && list="$(printf '%s\n' "$@")"
  _hub_page "$f" "$s" "## Pages

${list}"
}

_hub_fixture() {
  local d="$1/$2" domain="$2" part i n
  shift 2
  mkdir -p "$d"
  local nav=()
  local filler="filler leaf summary that pads one SKILL.md bullet toward the byte length of a real akn-expert nav line, which carries a long, specific description of what the page holds"
  for part in "$@"; do
    case "$part" in
      akn)
        _hub_index "$d/grpA/index.md" "grpA hub" "- [r](r.md) — r summary" "- [x](x.md) — x summary"
        _hub_page "$d/grpA/q.md" "q summary"
        _hub_page "$d/grpA/r.md" "r summary"
        _hub_page "$d/grpA/x.md" "x summary"
        _hub_index "$d/grpB/index.md" "grpB hub"
        _hub_page "$d/y.md" "y summary"
        nav+=("- [grpA/](grpA/index.md) — grpA hub" "- [grpB/](grpB/index.md) — grpB hub"
              "- [y](y.md) — y summary" "- [grpA/q](grpA/q.md) — q summary" "- [grpA/r](grpA/r.md) — r summary")
        for ((i = 1; i <= 300; i++)); do
          printf -v n 'l%03d' "$i"
          _hub_page "$d/grpA/$n.md" "$n $filler"
          nav+=("- [grpA/$n](grpA/$n.md) — $n $filler")
        done
        ;;
      grpF)
        _hub_index "$d/grpF/index.md" "grpF hub"
        _hub_page "$d/grpF/a.md" "a summary"
        _hub_page "$d/grpF/b.md" "b summary"
        nav+=("- [grpF/a](grpF/a.md) — a summary" "- [grpF/b](grpF/b.md) — b summary")
        ;;
      grpG)
        _hub_index "$d/grpG/index.md" "grpG hub"
        _hub_page "$d/grpG/w.md" "w summary"
        nav+=("- [grpG/](grpG/index.md) — grpG hub")
        ;;
      grpH)
        _hub_page "$d/grpH/p.md" "p summary"
        nav+=("- [grpH/p](grpH/p.md) — p summary")
        ;;
      grpJ)
        _hub_page "$d/grpJ/index.md" "grpJ hub" "No list here yet."
        _hub_page "$d/grpJ/r.md" "r summary"
        nav+=("- [grpJ/](grpJ/index.md) — grpJ hub")
        ;;
      grpE) _hub_page "$d/grpE/y.md" "y summary" ;;
      grpK) _hub_page "$d/grpK/z.md" "z summary" ;;
      *) echo "_hub_fixture: unknown part $part" >&2; return 1 ;;
    esac
  done
  {
    printf -- '---\nname: %s\ndescription: "hub fixture"\nwiki: true\n---\n\n# %s\n\n## Pages\n\n<!-- BEGIN:PAGES -->\n' "$domain" "$domain"
    [[ ${#nav[@]} -gt 0 ]] && printf '%s\n' "${nav[@]}"
    printf '<!-- END:PAGES -->\n\n## Meta\n'
  } > "$d/SKILL.md"
  printf 'entrypoint: SKILL.md\n' > "$d/.mditerc"
}
