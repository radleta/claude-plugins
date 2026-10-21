# scripts/

`mermaid-check.mjs` is a CLI, installed on PATH by `install.sh`: it parses every `mermaid`
block in the Markdown files it is given against the version in `mermaid-pin.json`.
`test-mermaid-check.mjs` tests it. Its packages install with
`npm ci` from `mermaid-lock.json`, so a pin change needs a new lock: in an empty directory, write
the `package.json` that `ensureInstalled` in `mermaid-check.mjs` builds from the pin, run
`npm install --package-lock-only --ignore-scripts`, and copy its `package-lock.json` over
`mermaid-lock.json`.
