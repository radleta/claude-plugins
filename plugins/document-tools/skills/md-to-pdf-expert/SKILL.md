---
name: md-to-pdf-expert
description: >-
  Generates branded PDFs from Markdown using named templates via `md-to-pdf` CLI.
  Use when converting markdown to PDF, generating branded documents, creating
  professional PDFs with cover pages, or producing policy/legal/business documents
  — even when no branding is needed or the output is a throwaway draft.
---

# MD-to-PDF Expert

`md-to-pdf` is on PATH (`~/.local/bin/`). Generates branded PDFs from Markdown via pandoc + xelatex.

## Quick Reference

```bash
md-to-pdf input.md                              # Clean PDF (no template)
md-to-pdf input.md -t akn                       # AKN branded
md-to-pdf input.md -t akn --cover               # With cover page
md-to-pdf input.md -t akn --cover --toc         # Cover + table of contents
md-to-pdf input.md -t akn --cover --confidential  # Confidential marking
md-to-pdf input.md --numbered                   # Auto-numbered sections
md-to-pdf input.md --title "My Doc"             # Override title (default: first H1)
md-to-pdf input.md --subtitle "Draft v2"        # Subtitle on cover page
md-to-pdf input.md --logo custom.png            # Custom logo
md-to-pdf input.md -o output.pdf                # Custom output path
md-to-pdf --list-templates                       # Show available templates
```

## Available Templates

| Template | Description |
|----------|-------------|
| `akn` | All Kids Network branded — green accents, AKN logo, professional layout |
| *(none)* | Clean defaults — Segoe UI, blue links, 0.8in margins |

## Flags

| Flag | Purpose |
|------|---------|
| `-t`, `--template` | Template name (folder under `templates/`) |
| `--cover` | Add branded cover page |
| `--toc` | Table of contents after cover |
| `--confidential` | "CONFIDENTIAL" marking on cover |
| `--numbered` | Auto-number sections |
| `--title` | Override document title (default: first `# H1`) |
| `--subtitle` | Subtitle on cover page |
| `--author` | Author name |
| `--email` | Author email |
| `--date` | Date string (default: current month/year) |
| `--logo` | Custom logo path (overrides template logo) |
| `-o`, `--output` | Output PDF path (default: `input.pdf`) |

## Requirements

- **pandoc** 3.0+ — `winget install pandoc` / `brew install pandoc`
- **xelatex** (TeX Live) — https://tug.org/texlive/

The script checks for these on every run and shows install instructions if missing.

## Adding Templates

1. Create `~/.claude/skills/md-to-pdf-expert/templates/<name>/`
2. Add `template.tex` (pandoc LaTeX template with `$body$`, `$title$`, etc.)
3. Add any assets (logos, fonts) in the same folder
4. Template is immediately available via `-t <name>`

See `templates/akn/template.tex` as a reference.

## Setup

See [SETUP.md](SETUP.md) for PATH shim creation, dependency installation, and verification steps.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common pandoc/xelatex errors and fixes.

## Gotchas

Use Read tool on [GOTCHAS.md](GOTCHAS.md) when debugging pandoc/xelatex issues or adding new templates.
