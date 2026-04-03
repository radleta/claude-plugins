# MD-to-PDF — Troubleshooting

## Verifying the shim

The `md-to-pdf` command should be on PATH via a shim at `~/.local/bin/md-to-pdf`. Test:
```bash
which md-to-pdf        # Should resolve to ~/.local/bin/md-to-pdf
md-to-pdf --help       # Should show usage and available templates
```

If missing, re-create the shim (see SETUP.md).

## Common issues

| Symptom | Fix |
|---------|-----|
| `pandoc: command not found` | Install pandoc: `winget install pandoc` (Windows), `brew install pandoc` (macOS) |
| `xelatex: command not found` | Install TeX Live: https://tug.org/texlive/ |
| `Template not found: <name>` | Check spelling; run `md-to-pdf --list-templates` to see available templates |
| `Template missing template.tex` | Ensure `templates/<name>/template.tex` exists in the skill directory |
| `File not found: <input>` | Check the input file path; use absolute path if relative fails |
| PDF is blank or empty | Verify the input markdown has content; check pandoc output for LaTeX errors |
| Logo not showing on cover | Logos must resolve to absolute paths. The script auto-detects template logos, but custom `--logo` paths must exist |
| Sections double-numbered | Don't use `--numbered` with manually numbered headings. See GOTCHAS.md "Section Numbering" |
| Title hyphenated on cover | Known TikZ issue. See GOTCHAS.md "Cover Page Title Hyphenation" |
| `! LaTeX Error: File 'extarticle.cls' not found` | Install the `extsizes` LaTeX package: `tlmgr install extsizes` |
| `! Font ... not found` | The template uses Segoe UI (Windows default). On Linux/macOS, install it or edit `template.tex` to use a different font |
| `! Package inputenc Error: Unicode character` | Expected — xelatex handles Unicode natively. If this appears, ensure `--pdf-engine=xelatex` is set (the script does this automatically) |
| Resource path separator issues | On Windows/MSYS2, the script auto-detects and uses `;` instead of `:`. If issues persist, check `$OSTYPE` value |
| `pandoc: Cannot decode byte` | Input file encoding issue. Save the markdown as UTF-8 |

## Debugging pandoc/xelatex errors

Run pandoc manually with verbose output to see the full error:

```bash
pandoc input.md -o output.pdf --pdf-engine=xelatex --verbose 2>&1 | tail -50
```

For template issues, generate the intermediate LaTeX and inspect it:

```bash
pandoc input.md -o output.tex --template=path/to/template.tex
# Then compile manually:
xelatex output.tex
```

## Verifying PDF output

Chrome's PDF viewer sometimes fails to render TikZ overlays. Use `pdftocairo` (included with TeX Live) to convert PDF pages to PNG for reliable visual verification:

```bash
pdftocairo -png -r 150 output.pdf output-page
# Creates output-page-1.png, output-page-2.png, etc.
```
