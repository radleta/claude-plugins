# WinForms Patterns in PowerShell

Detailed patterns for PowerShell scripts that use Windows Forms — system tray icons, timers, context menus, GDI+ rendering, and the message pump.

---

## Application Lifecycle

### The Message Pump

PowerShell WinForms apps require a message pump to process Windows messages (click events, timer ticks, paint messages). Without it, the UI is unresponsive.

```powershell
# Standard pattern:
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run()
# Execution blocks here until Application.Exit() is called
```

**C# equivalent**:
```csharp
Application.EnableVisualStyles();
Application.Run(new TrayApplicationContext());
// TrayApplicationContext : ApplicationContext manages lifetime
```

**Key difference**: In PowerShell, `Application.Run()` with no argument runs a bare message loop. In C#, prefer `Application.Run(context)` with an `ApplicationContext` subclass that creates the NotifyIcon in its constructor and disposes it in `Dispose(bool)`.

### Cleanup Pattern

```powershell
try {
    # ... setup timers, icons, etc.
    [System.Windows.Forms.Application]::Run()
} finally {
    $script:pollTimer.Stop()
    $script:pollTimer.Dispose()
    foreach ($session in $script:sessions.Values) {
        $session.Icon.Visible = $false
        $session.Icon.Dispose()
    }
    $script:mutex.ReleaseMutex()
    $script:mutex.Dispose()
}
```

**C# equivalent**: Override `ApplicationContext.Dispose(bool)` or use `IAsyncDisposable` with a hosted service pattern.

---

## NotifyIcon Patterns

### Creating Icons

```powershell
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = $myIcon
$icon.Text = "Project: idle (Desktop 2)"   # Tooltip (max 128 chars)
$icon.Visible = $true
```

**C# equivalent**:
```csharp
var icon = new NotifyIcon
{
    Icon = myIcon,
    Text = "Project: idle (Desktop 2)",
    Visible = true
};
```

### Dynamic Icon Generation with GDI+

PowerShell scripts often generate icons programmatically (colored circles, status indicators):

```powershell
function New-CircleIcon {
    param([System.Drawing.Color]$Color)
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush($Color)
    $g.FillEllipse($brush, 1, 1, 13, 13)
    $brush.Dispose()
    $g.Dispose()
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    return @{ Icon = $icon; Bitmap = $bmp }
}
```

**C# equivalent**:
```csharp
static Icon CreateCircleIcon(Color color)
{
    using var bmp = new Bitmap(16, 16);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.Clear(Color.Transparent);
    using var brush = new SolidBrush(color);
    g.FillEllipse(brush, 1, 1, 13, 13);
    return Icon.FromHandle(bmp.GetHicon());
    // CAUTION: caller must eventually call DestroyIcon() on the HICON
}
```

**GDI+ handle leak warning**: `Icon.FromHandle()` does not take ownership of the HICON. In PowerShell this is often ignored (icons are cached for the script lifetime). In C#, use `DestroyIcon` P/Invoke or cache icons in a `Dictionary<string, Icon>` that disposes on shutdown.

### Icon Caching

PowerShell scripts often cache generated icons to avoid GDI churn:

```powershell
$script:agedIconCache = @{}

function Get-AgedIcon {
    param([string]$Status, [double]$Factor)
    $key = "$Status-$Factor"
    if ($script:agedIconCache.ContainsKey($key)) {
        return $script:agedIconCache[$key].Icon
    }
    # ... generate icon ...
    $script:agedIconCache[$key] = $entry
    return $entry.Icon
}
```

**C# equivalent**: `ConcurrentDictionary<string, Icon>` or a simple `Dictionary` (safe since WinForms Timer events are single-threaded).

---

## Event Handler Patterns

### ScriptBlock Event Handlers

PowerShell wires events using `.add_EventName()` with a scriptblock:

```powershell
$icon.add_MouseClick({ param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        Switch-ToSession $sessionId
    }
})

$icon.add_BalloonTipClicked({
    Switch-ToSession $sessionId
})
```

**C# equivalent**:
```csharp
icon.MouseClick += (sender, e) =>
{
    if (e.Button == MouseButtons.Left)
        SwitchToSession(sessionId);
};

icon.BalloonTipClicked += (sender, e) => SwitchToSession(sessionId);
```

### Closure Capture in Event Handlers

PowerShell scriptblock event handlers capture variables from the enclosing scope. This is identical to C# lambda closures, but with a critical difference: PowerShell closures capture by **reference** to the scope, not by value. If a variable changes after the scriptblock is created, the scriptblock sees the new value.

```powershell
# Common pattern: capture $sessionId for each icon's click handler
foreach ($sid in $sessionIds) {
    $localSid = $sid   # Local copy to avoid closure-over-loop-variable bug
    $icon.add_MouseClick({ Switch-ToSession $localSid })
}
```

**C# equivalent**: Same loop-variable capture issue exists in C# (fixed in C# 5+ for `foreach`, but still applies in `for` loops).

---

## Context Menu Patterns

### ContextMenuStrip with Nested Submenus

```powershell
$menu = New-Object System.Windows.Forms.ContextMenuStrip

# Simple item
$switchItem = New-Object System.Windows.Forms.ToolStripMenuItem("Switch to Desktop")
$switchItem.add_Click({ Switch-ToDesktop $desktopIndex })
$menu.Items.Add($switchItem) | Out-Null

# Submenu
$soundMenu = New-Object System.Windows.Forms.ToolStripMenuItem("Sound Pack")
foreach ($packName in $script:loadedPacks.Keys) {
    $item = New-Object System.Windows.Forms.ToolStripMenuItem($packName)
    $localPack = $packName
    $item.add_Click({ Set-SoundPack $sessionId $localPack })
    if ($packName -eq $currentPack) { $item.Checked = $true }
    $soundMenu.DropDownItems.Add($item) | Out-Null
}
$menu.Items.Add($soundMenu) | Out-Null

# Separator
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Assign to icon
$icon.ContextMenuStrip = $menu
```

**C# equivalent**: Same classes, same hierarchy. Use collection initializers for cleaner code:
```csharp
icon.ContextMenuStrip = new ContextMenuStrip
{
    Items =
    {
        new ToolStripMenuItem("Switch to Desktop", null, (s, e) => SwitchToDesktop(index)),
        BuildSoundPackSubmenu(sessionId, currentPack),
        new ToolStripSeparator(),
    }
};
```

### Dynamic Menu Rebuilding

PowerShell tray apps often rebuild context menus on each right-click to reflect current state:

```powershell
$icon.add_MouseClick({ param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
        $menu = Build-ContextMenu $sessionId
        $icon.ContextMenuStrip = $menu
    }
})
```

**C# equivalent**: Same approach, or use `ContextMenuStrip.Opening` event to update items dynamically without rebuilding.

---

## Timer Patterns

### System.Windows.Forms.Timer (UI Thread)

This is the correct timer for WinForms tray apps. Events fire on the UI thread — safe to touch NotifyIcon, menus, and icons directly.

```powershell
$script:pollTimer = New-Object System.Windows.Forms.Timer
$script:pollTimer.Interval = 1000    # 1 second
$script:pollTimer.add_Tick({
    Update-AllSessions    # Safe: runs on UI thread
})
$script:pollTimer.Start()
```

**C# equivalent**:
```csharp
_pollTimer = new System.Windows.Forms.Timer { Interval = 1000 };
_pollTimer.Tick += (s, e) => UpdateAllSessions();
_pollTimer.Start();
```

### Multiple Timers

Complex tray apps use separate timers for different frequencies:

```powershell
# Fast poll timer (1s) — check for state file changes
$script:pollTimer = New-Object System.Windows.Forms.Timer
$script:pollTimer.Interval = 1000

# Slow cleanup timer (60s) — remove stale sessions
$script:cleanupTimer = New-Object System.Windows.Forms.Timer
$script:cleanupTimer.Interval = 60000
```

**C# equivalent**: Same pattern. Both fire on the UI thread, so no concurrency issues between them.

### Why NOT System.Timers.Timer

`System.Timers.Timer` fires events on a ThreadPool thread. Touching WinForms UI objects from a non-UI thread causes:
- `InvalidOperationException` ("Cross-thread operation not valid")
- Subtle corruption (icons not updating, menus not showing)
- Race conditions with the poll loop

If you must use `System.Timers.Timer` (e.g., for high-precision timing), set `SynchronizingObject` to a Form or Control. But for tray apps, `System.Windows.Forms.Timer` is the right choice.

---

## Balloon Notifications (Toast)

```powershell
$icon.BalloonTipTitle = "Claude Code"
$icon.BalloonTipText = "Session idle — needs your input"
$icon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$icon.ShowBalloonTip(5000)    # Timeout in ms (Windows may ignore this)

# Handle click on balloon
$icon.add_BalloonTipClicked({
    Switch-ToSession $sessionId
})
```

**C# equivalent**: Same API. For modern Windows 10/11 toast notifications, consider `Microsoft.Toolkit.Uwp.Notifications` NuGet package or `Windows.UI.Notifications` WinRT API for richer toasts with buttons and images.

---

## Sound Playback

```powershell
$script:soundPlayer = New-Object System.Media.SoundPlayer
$script:soundPlayer.SoundLocation = $wavPath
$script:soundPlayer.Play()    # Async playback, non-blocking
```

**C# equivalent**:
```csharp
using var player = new SoundPlayer(wavPath);
player.Play(); // async, non-blocking
```

For more control (multiple simultaneous sounds, volume, formats beyond WAV), use `NAudio` NuGet package in C#.

---

## Single Instance Guard

```powershell
$mutexName = "Global\ClaudeTrayMonitor"
$script:mutex = New-Object System.Threading.Mutex($false, $mutexName)
if (-not $script:mutex.WaitOne(0)) {
    Write-Host "Already running."
    exit 0
}
```

**C# equivalent**:
```csharp
using var mutex = new Mutex(false, @"Global\ClaudeTrayMonitor");
if (!mutex.WaitOne(0))
{
    Console.WriteLine("Already running.");
    return;
}
```

---

## Common WinForms Porting Mistakes

### Forgetting to Dispose GDI+ Objects

PowerShell scripts often skip explicit disposal — the GC eventually cleans up. In C#, always use `using` statements for `Bitmap`, `Graphics`, `Brush`, `Pen`, `Font`, and `Icon` objects. GDI+ handles are a limited system resource.

### Wrong Timer Type

Using `System.Timers.Timer` or `System.Threading.Timer` in a WinForms tray app leads to cross-thread exceptions. Always use `System.Windows.Forms.Timer` for operations that touch UI objects.

### Not Calling Application.Run()

Without `Application.Run()`, timers do not tick and events do not fire. The message pump is required for WinForms to function.

### Icon.FromHandle HICON Leak

`Icon.FromHandle(bmp.GetHicon())` creates an HICON that is not freed when the Icon is disposed. Call `DestroyIcon` P/Invoke to release it, or cache icons for the application lifetime and release on exit.

### Tooltip Length Limit

`NotifyIcon.Text` is limited to 128 characters (63 chars on older Windows). Truncate gracefully in the porting layer.
