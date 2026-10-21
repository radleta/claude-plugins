# contents-fence.awk — the one implementation of a wiki page's contents-list
# fence, shared by wiki-write.sh (mode=write) and wiki-health.sh (mode=check).
#
#   <!-- BEGIN:CONTENTS -->
#   - <heading>          one bullet per '## ' heading, in page order
#   <!-- END:CONTENTS -->
#
# A page needs the fence when it runs past LIMIT lines, its own fence excluded,
# and has at least one '## ' heading outside a code block. The fence sits after
# the H1 (or after the frontmatter when there is no H1 before the first '## '),
# preceded by one blank line (none at the top of a page with neither), which is
# removed with the fence on regeneration so a rewrite is idempotent. Markers
# and headings inside ``` / ~~~ blocks are content, not structure.
#
# mode=write  One file. Prints it with every well-formed fence and every BEGIN
#             with no END removed and, when the page needs one, a fresh fence
#             inserted; lines end in
#             ENVIRON["CF_ORS"] (default LF) so a CRLF page stays CRLF. Prints
#             nothing and exits 10 when the page has no fence and needs none,
#             so the caller keeps the file byte-for-byte.
# mode=check  Any number of files. Prints "<file>\tmissing" for a page that
#             needs a fence and has none, "<file>\tstale" for a fence whose
#             bullets differ from the headings or a BEGIN with no END.

BEGIN {
  B = "<!-- BEGIN:CONTENTS -->"; E = "<!-- END:CONTENTS -->"; LIMIT = 100
  ORS = (ENVIRON["CF_ORS"] != "" ? ENVIRON["CF_ORS"] : "\n")
  unchanged = 0
}
FNR == 1 && NR > 1 { page() }
{ sub(/\r$/, ""); L[++n] = $0; F = FILENAME }
END {
  if (n) page()
  if (mode == "write" && unchanged) exit 10
}

function fence(lead,   j) {
  if (lead) print ""
  print B
  for (j = 1; j <= nh; j++) print "- " H[j]
  print E
}

function page(   i, j, k, m, incode, fm, h1, h, need, hasfence, broken, got, want, anchor) {
  # Pass 1: drop well-formed fences (and the blank line before each) into K,
  # collecting the bullets they held.
  incode = 0; m = 0; hasfence = 0; broken = 0; got = ""
  for (i = 1; i <= n; i++) {
    if (L[i] ~ /^(```|~~~)/) incode = !incode
    if (!incode && L[i] == B) {
      for (j = i + 1; j <= n && L[j] != E && L[j] != B; j++) ;
      if (j <= n && L[j] == E) {
        hasfence = 1
        for (k = i + 1; k < j; k++) got = got L[k] "\n"
        if (m > 0 && K[m] == "") m--
        i = j
        continue
      }
      broken = 1
      # An unterminated BEGIN is dropped in write mode, so a rewrite repairs it.
      if (mode == "write") { if (m > 0 && K[m] == "") m--; continue }
    }
    K[++m] = L[i]
  }

  # Pass 2: frontmatter, H1 and '## ' headings of the fence-free page.
  fm = 0
  if (K[1] ~ /^---[ \t]*$/)
    for (i = 2; i <= m; i++) if (K[i] ~ /^---[ \t]*$/) { fm = i; break }
  incode = 0; h1 = 0; nh = 0; want = ""
  for (i = fm + 1; i <= m; i++) {
    if (K[i] ~ /^(```|~~~)/) { incode = !incode; continue }
    if (incode) continue
    if (K[i] ~ /^## /) {
      h = K[i]; sub(/^##[ \t]+/, "", h); sub(/[ \t]+$/, "", h)
      H[++nh] = h; want = want "- " h "\n"
    } else if (!h1 && !nh && K[i] ~ /^# /) h1 = i
  }
  need = (m > LIMIT && nh > 0)

  if (mode == "check") {
    if (broken || (hasfence && got != want)) print F "\tstale"
    else if (need && !hasfence) print F "\tmissing"
  } else if (!need && !hasfence && !broken) {
    unchanged = 1
  } else {
    anchor = h1 ? h1 : fm
    if (need && anchor == 0) fence(0)
    for (i = 1; i <= m; i++) {
      print K[i]
      if (need && i == anchor) fence(1)
    }
  }
  split("", L); split("", K); split("", H); n = 0
}
