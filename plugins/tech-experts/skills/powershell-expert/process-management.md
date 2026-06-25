---
summary: "PowerShell process management patterns: Get-Process, WMI/CIM queries for parent PID, process tree walking, and C# System.Diagnostics.Process equivalents."
tags: [powershell-expert/process-management]
---

# Process Management

## Get-Process and WMI

```powershell
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid").ParentProcessId
```

**C# equivalent**:
```csharp
var proc = Process.GetProcessById(pid);                         // throws if not found
var searcher = new ManagementObjectSearcher(
    $"SELECT ParentProcessId FROM Win32_Process WHERE ProcessId={pid}");
```

## Process Tree Walking

PowerShell scripts often walk process trees via WMI to find parent/child relationships:

```powershell
# Walk up to find terminal window
$currentPid = $claudePid
while ($currentPid -ne 0) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$currentPid"
    if ($proc.Name -match "WindowsTerminal|wezterm") { break }
    $currentPid = $proc.ParentProcessId
}
```

**C# equivalent**: Use `ManagementObjectSearcher` with `Win32_Process` WMI class, or use `System.Diagnostics.Process` and walk `Process.Parent` (.NET 9+). For older .NET, use P/Invoke with `NtQueryInformationProcess` or keep WMI.
