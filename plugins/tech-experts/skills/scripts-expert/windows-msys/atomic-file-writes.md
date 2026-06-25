---
summary: "Write-to-temp-then-rename pattern for race-free inter-process file sharing in bash and Node.js."
tags: [scripts-expert/windows-msys]
---

# Atomic File Writes for IPC

When multiple processes share state via files (hooks writing, monitors polling), use write-to-temp-then-rename to prevent partial reads.

```bash
# Bash
echo "$data" > "$dir/.tmp-$id"
mv "$dir/.tmp-$id" "$dir/$id.json"
```

```javascript
// Node.js
writeFileSync(join(dir, `.tmp-${id}`), JSON.stringify(state), 'utf-8');
renameSync(join(dir, `.tmp-${id}`), join(dir, `${id}.json`));
```

See also: [powershell-bom.md](powershell-bom.md) for safe JSON encoding when PowerShell is the writer.
