# MD-to-PDF Gotchas

Lessons learned from building pandoc + xelatex PDF templates.

## Section Numbering

**Never mix manual numbers in markdown with `--numbered`.** If your markdown has `## 1. Overview`, pandoc's `--number-sections` produces "1.1 1. Overview". Pick one approach:
- Use `--numbered` and write plain headings (`## Overview`)
- Or number manually in markdown and skip `--numbered`

## Cover Page Title Hyphenation

TikZ nodes don't respect `\hyphenpenalty`. Long titles get hyphenated ("Pric-ing Overview"). Fix: wrap title in `\parbox` with `\tolerance=9999\emergencystretch=3em`:

```latex
\parbox{6.5in}{\centering\tolerance=9999\emergencystretch=3em $title$}
```

## TikZ Node Stacking

Don't use separate TikZ nodes for title/subtitle/meta — z-order and spacing are fragile. Use a single node with `\\[spacing]` separators for natural vertical flow.

## Font Size Below 10pt

Standard `article` class only supports 10pt minimum. Use `extarticle` for 9pt or 8pt:

```latex
\documentclass[9pt]{extarticle}
```

## Full-Width Tables

Pandoc longtables default to auto-width. Force full width:

```latex
\setlength{\LTleft}{0pt}
\setlength{\LTright}{0pt}
```

## Resource Path

Pandoc needs `--resource-path` set to both the input file's directory AND the template directory, so logos and images resolve from either location:

```bash
--resource-path="$INPUT_DIR:$TEMPLATE_DIR"
```

## PDF Verification

Chrome's PDF viewer sometimes fails to render TikZ overlays. Use `pdftocairo` (included with TeX Live) to convert PDF pages to PNG for reliable visual verification:

```bash
pdftocairo -png -r 150 output.pdf output-page
```

## Tailwind CSS + Legal Docs (Site HTML)

If publishing markdown as site HTML with Tailwind, Preflight resets `list-style: none` on `<ul>` and `<ol>`. Explicitly restore:

```css
.legal-doc ul { list-style-type: disc; }
.legal-doc ol { list-style-type: decimal; }
```

## xelatex Logo Path Must Be Absolute

`--resource-path` is a pandoc feature — xelatex runs in a temp directory and doesn't inherit it. `\includegraphics{logo.png}` with a bare filename fails. Always pass the logo as an absolute path via pandoc metadata (`--metadata logo="/full/path/to/logo.png"`). The script auto-detects the template's logo and resolves it to an absolute path.

## Windows Path Separators

On Windows/MSYS2, Windows pandoc.exe uses `;` as `--resource-path` separator (not `:`). The script auto-detects MSYS2/Cygwin and uses the right separator.

## Windows Symlinks

MSYS2 `ln -s` creates copies unless `MSYS=winsymlinks:nativestrict` is set, and native symlinks require elevated privileges. The `~/local/bin/md-to-pdf` wrapper uses a thin `exec` shim instead of a symlink to avoid these issues.
