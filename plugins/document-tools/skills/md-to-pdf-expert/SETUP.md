# MD-to-PDF — Setup

## Requirements

- **pandoc** 3.0+ — document converter
- **xelatex** (TeX Live) — PDF engine

The script checks for these on every run and shows install instructions if missing.

### Installing pandoc

```bash
# Windows
winget install pandoc

# macOS
brew install pandoc

# Linux (Debian/Ubuntu)
sudo apt install pandoc
```

Verify: `pandoc --version` (should show 3.x+)

### Installing TeX Live (xelatex)

Download from https://tug.org/texlive/ or:

```bash
# Windows — install via TeX Live installer (texlive.exe)
# Full install recommended; minimal installs often miss packages.

# macOS
brew install --cask mactex

# Linux (Debian/Ubuntu)
sudo apt install texlive-xetex texlive-fonts-extra
```

Verify: `xelatex --version`

## Put on PATH

Create a shim in `~/.local/bin/` so Claude (and you) can invoke `md-to-pdf` without path resolution:

```bash
mkdir -p ~/.local/bin
cat > ~/.local/bin/md-to-pdf << 'SHIM'
#!/usr/bin/env bash
exec "$HOME/.claude/skills/md-to-pdf-expert/md-to-pdf.sh" "$@"
SHIM
chmod +x ~/.local/bin/md-to-pdf
```

Verify `~/.local/bin` is on your PATH (`which md-to-pdf` should resolve). If not, add it to your shell profile:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

## Verify

Test the full chain (shim → script → pandoc → xelatex):

```bash
md-to-pdf --help
# Expected: usage info and available templates

md-to-pdf --list-templates
# Expected: list of template names (e.g., akn)
```

End-to-end test with a sample file:

```bash
echo '# Test Document

This is a test.' > /tmp/test-md-to-pdf.md
md-to-pdf /tmp/test-md-to-pdf.md -o /tmp/test-md-to-pdf.pdf
ls -la /tmp/test-md-to-pdf.pdf
# Expected: PDF file exists
```

## Adding Templates

1. Create `~/.claude/skills/md-to-pdf-expert/templates/<name>/`
2. Add `template.tex` (pandoc LaTeX template with `$body$`, `$title$`, etc.)
3. Add any assets (logos, fonts) in the same folder
4. Template is immediately available via `-t <name>`

See `templates/akn/template.tex` as a reference.
