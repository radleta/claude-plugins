---
name: winforms-expert
description: "Validated Windows Forms patterns for NotifyIcon system tray apps, GDI+ icon rendering, context menus, balloon notifications, message pumps, and GDI handle management. Use when building system tray applications, creating NotifyIcon monitors, rendering icons with GDI+, or managing Windows message loops — even for simple tray icon utilities."
---

<role>
  <identity>Windows Forms and system tray application expert with deep knowledge of NotifyIcon, GDI+, and Win32 message pump patterns in .NET 10+ / C# 13+</identity>

  <purpose>
    Provide investigation-driven, rule-based guidance that prevents the common WinForms system tray mistakes and ensures correct, production-ready NotifyIcon applications
  </purpose>

  <expertise>
    <area>NotifyIcon lifecycle (creation, icon assignment, visibility, disposal)</area>
    <area>ContextMenuStrip construction and dynamic updates</area>
    <area>BalloonTip notifications (show, timeout, click events)</area>
    <area>GDI+ icon rendering (Bitmap, Graphics, programmatic circle/text icons)</area>
    <area>Icon color manipulation and aging/darkening effects</area>
    <area>Windows message pump (Application.Run, ApplicationContext)</area>
    <area>Single-instance enforcement (Mutex)</area>
    <area>GDI handle management, disposal patterns, and leak prevention</area>
    <area>Thread affinity and UI thread marshalling</area>
    <area>.NET 10 / AOT considerations for WinForms</area>
  </expertise>

  <scope>
    <in-scope>
      <item>System tray (NotifyIcon) application architecture</item>
      <item>GDI+ icon creation and manipulation</item>
      <item>ContextMenuStrip and dynamic menus</item>
      <item>BalloonTip notifications and user interaction</item>
      <item>ApplicationContext-based tray apps (no main form)</item>
      <item>Single-instance apps with Mutex</item>
      <item>Win32 interop for icon handles (DestroyIcon, GetHicon)</item>
      <item>Thread safety in WinForms tray apps</item>
    </in-scope>

    <out-of-scope>
      <item>General WinForms form/control design (use standard WinForms docs)</item>
      <item>WPF system tray approaches (Hardcodet.NotifyIcon.Wpf)</item>
      <item>MAUI or cross-platform tray solutions</item>
      <item>Windows service architecture (use service patterns)</item>
    </out-of-scope>
  </scope>
</role>

## Top 10 System Tray Agent Mistakes

These are the errors AI agents make most often when building NotifyIcon apps. Every rule in this skill exists to prevent one of these.

| # | Mistake | Consequence |
|---|---------|-------------|
| 1 | **No DestroyIcon after GetHicon** | GDI handle leak; app crashes at 10,000 handles |
| 2 | **NotifyIcon without hidden form/context** | No message pump; icon appears but events never fire |
| 3 | **Forgetting NotifyIcon.Visible = false on exit** | Ghost icon stays in tray until mouse hovers over it |
| 4 | **Updating UI from background thread** | Cross-thread exception or silent corruption |
| 5 | **Icon.FromHandle without ownership awareness** | Dispose does nothing; handle leaks silently |
| 6 | **No Mutex for single-instance** | Multiple tray icons from duplicate launches |
| 7 | **Disposing Bitmap before NotifyIcon uses it** | Blank or corrupt icon in tray |
| 8 | **BalloonTip click handler not wired before Show** | Click events silently lost |
| 9 | **ContextMenuStrip items modified from wrong thread** | Menu corruption or InvalidOperationException |
| 10 | **No GC.KeepAlive(mutex) after Application.Run** | Mutex GC'd; second instance launches freely |

## Core Principles

### 1. Message Pump is Mandatory

NotifyIcon relies on a Win32 window to receive shell notification messages. Without a message pump, the icon appears but context menus, balloon clicks, and double-click events never fire.

**Rules:**
- Always use `Application.Run(context)` with a custom `ApplicationContext` for tray-only apps
- Never use a console app `Main` that blocks on `Console.ReadLine()` — no message pump
- The ApplicationContext creates an internal hidden window that processes WM_NOTIFYICON messages
- Call `Application.EnableVisualStyles()` and `Application.SetHighDpiMode(HighDpiMode.SystemAware)` before `Application.Run`

### 2. GDI Handles Are Unmanaged Resources

Every `Bitmap`, `Graphics`, `Pen`, `Brush`, `Font`, and `Icon` wraps a GDI/GDI+ handle. Windows limits each process to 10,000 GDI objects. System tray apps that update icons frequently (timers, status changes) hit this limit fast.

**Rules:**
- Wrap every GDI+ object in `using` statements or dispose explicitly in `finally`
- After `bitmap.GetHicon()`, you own the HICON — call `DestroyIcon(hIcon)` via P/Invoke after creating the Icon
- `Icon.FromHandle(hIcon)` does NOT take ownership — `icon.Dispose()` will NOT call DestroyIcon
- Clone pattern: `var icon = (Icon)Icon.FromHandle(hIcon).Clone(); DestroyIcon(hIcon);` — the clone owns its handle
- Cache icons when possible; do not recreate on every poll tick
- Monitor handle count during development: Task Manager > Details > add "GDI Objects" column

**DestroyIcon P/Invoke:**
```csharp
[DllImport("user32.dll", SetLastError = true)]
static extern bool DestroyIcon(IntPtr hIcon);
```

### 3. Thread Affinity is Non-Negotiable

All WinForms controls (including NotifyIcon) have thread affinity to the thread that created them. Accessing from another thread causes `InvalidOperationException` or silent corruption.

**Rules:**
- Create NotifyIcon on the UI thread (inside ApplicationContext constructor or after Application.Run starts)
- Use `SynchronizationContext.Current.Post()` or `Control.Invoke()` to marshal calls to the UI thread
- For timer-based polling, use `System.Windows.Forms.Timer` (fires on UI thread) not `System.Threading.Timer`
- Background work (file I/O, network) can run on thread pool, but marshal results back to UI thread

### 4. Dispose Everything on Exit

NotifyIcon is a Win32 shell component. If you do not explicitly clean up, the icon persists in the tray as a ghost until the user hovers over it (Windows only removes it on mouse-over after the owning process dies).

**Rules:**
- Set `notifyIcon.Visible = false` before disposing
- Override `ExitThreadCore()` in your ApplicationContext to dispose NotifyIcon
- Dispose the ContextMenuStrip and all dynamically created icons
- Handle `Application.ApplicationExit` as a safety net
- Handle `AppDomain.CurrentDomain.ProcessExit` for unexpected termination

### 5. Single-Instance Enforcement

System tray apps should only run one instance. Without enforcement, each launch creates another icon.

**Rules:**
- Use a named Mutex with a unique name (include a GUID)
- Check `new Mutex(true, name, out bool createdNew)` — if `!createdNew`, exit
- Call `GC.KeepAlive(mutex)` after `Application.Run()` to prevent GC during the app lifetime
- Optionally signal the existing instance via named pipe or window message to bring it to front

## Investigation Protocol

Before building a system tray application, investigate:

- [ ] **Target .NET version** — .NET 10 supports WinForms but AOT has limitations (COM interop issues). Determine if AOT is required or if standard deployment suffices.
- [ ] **Icon requirements** — Static `.ico` files vs dynamic GDI+ rendering. If dynamic, determine sizes (16x16 for tray, 32x32 for balloon), color depth, and update frequency.
- [ ] **Context menu complexity** — Static items vs dynamic submenus that change at runtime. Dynamic menus need careful thread-safe update patterns.
- [ ] **Notification strategy** — BalloonTips (built-in, limited styling) vs Windows Toast Notifications (richer, requires COM). BalloonTips are simpler but deprecated in Windows 10+ (they become Action Center toasts).
- [ ] **IPC mechanism** — How the tray app receives data: file polling, named pipes, memory-mapped files, or WM_COPYDATA messages.
- [ ] **Multi-monitor / high DPI** — Icon rendering must account for DPI scaling. Use `SystemInformation.SmallIconSize` for actual tray icon dimensions.

## NotifyIcon Lifecycle

### Creation

```csharp
// Inside ApplicationContext constructor or setup method
notifyIcon = new NotifyIcon
{
    Icon = LoadOrCreateIcon(),
    Text = "My Tray App — Initializing",  // Tooltip, max 127 chars
    Visible = true,
    ContextMenuStrip = BuildContextMenu()
};

// Wire events BEFORE showing
notifyIcon.DoubleClick += OnTrayDoubleClick;
notifyIcon.BalloonTipClicked += OnBalloonClicked;
notifyIcon.BalloonTipClosed += OnBalloonClosed;
```

### Icon Updates (Safe Pattern)

```csharp
void UpdateIcon(Color color, string label)
{
    const int size = 16;
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;

    using var brush = new SolidBrush(color);
    g.FillEllipse(brush, 1, 1, size - 2, size - 2);

    IntPtr hIcon = bmp.GetHicon();
    try
    {
        var newIcon = Icon.FromHandle(hIcon);
        var oldIcon = notifyIcon.Icon;
        notifyIcon.Icon = (Icon)newIcon.Clone();
        oldIcon?.Dispose();
    }
    finally
    {
        DestroyIcon(hIcon);  // CRITICAL: prevent GDI handle leak
    }

    notifyIcon.Text = label.Length > 127 ? label[..127] : label;
}
```

### Balloon Notifications

```csharp
// Wire handler BEFORE calling ShowBalloonTip
notifyIcon.BalloonTipClicked += (s, e) => OnBalloonAction();
notifyIcon.BalloonTipClosed += (s, e) => OnBalloonDismissed();

notifyIcon.BalloonTipTitle = "Status Changed";
notifyIcon.BalloonTipText = "Session is now idle.";
notifyIcon.BalloonTipIcon = ToolTipIcon.Info;
notifyIcon.ShowBalloonTip(5000);  // timeout in ms (Windows may ignore this)
```

**Gotchas:**
- `ShowBalloonTip` timeout is a *suggestion* — Windows 10+ ignores it and uses its own duration
- BalloonTipClicked only fires if the user clicks the balloon body, not the X button
- BalloonTipClosed fires on both timeout and explicit close
- Only one balloon can show at a time per NotifyIcon; new calls replace the previous

### Disposal

```csharp
protected override void ExitThreadCore()
{
    notifyIcon.Visible = false;   // Remove from tray immediately
    notifyIcon.Icon?.Dispose();
    notifyIcon.ContextMenuStrip?.Dispose();
    notifyIcon.Dispose();

    // Dispose any cached Icon objects
    foreach (var icon in iconCache.Values)
        icon.Dispose();

    base.ExitThreadCore();  // Exits the message loop
}
```

## ContextMenuStrip Patterns

### Static Menu

```csharp
ContextMenuStrip BuildContextMenu()
{
    var menu = new ContextMenuStrip();
    menu.Items.Add("Show Status", null, (s, e) => ShowStatus());
    menu.Items.Add(new ToolStripSeparator());
    menu.Items.Add("Exit", null, (s, e) => Application.Exit());
    return menu;
}
```

### Dynamic Submenus

For menus that change at runtime (e.g., list of active sessions), rebuild items in the `Opening` event:

```csharp
menu.Opening += (s, e) =>
{
    var sessionsItem = menu.Items["Sessions"] as ToolStripMenuItem;
    sessionsItem?.DropDownItems.Clear();

    foreach (var session in GetActiveSessions())
    {
        var item = new ToolStripMenuItem(session.Name);
        item.Checked = session.IsActive;
        item.Click += (_, _) => SwitchToSession(session);
        sessionsItem?.DropDownItems.Add(item);
    }
};
```

**Rules:**
- Rebuild dynamic items in `Opening` event, not on a timer
- Always clear old items before adding new ones to prevent accumulation
- `Opening` fires on the UI thread, so no marshalling needed

## GDI+ Icon Rendering

### Circle Icon with Color

```csharp
Icon CreateCircleIcon(Color fill, int size = 16)
{
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.Clear(Color.Transparent);

    using var brush = new SolidBrush(fill);
    g.FillEllipse(brush, 1, 1, size - 2, size - 2);

    // Optional: border for visibility on both light and dark taskbars
    using var pen = new Pen(Color.FromArgb(80, 0, 0, 0), 1f);
    g.DrawEllipse(pen, 1, 1, size - 2, size - 2);

    IntPtr hIcon = bmp.GetHicon();
    var icon = (Icon)Icon.FromHandle(hIcon).Clone();
    DestroyIcon(hIcon);
    return icon;  // Caller owns this icon and must dispose it
}
```

### Color Aging / Darkening

To dim icons for stale/aging sessions, lerp toward gray:

```csharp
Color AgeColor(Color original, double ageFactor)
{
    // ageFactor: 0.0 = fresh, 1.0 = fully aged
    ageFactor = Math.Clamp(ageFactor, 0.0, 1.0);
    int r = (int)(original.R + (128 - original.R) * ageFactor);
    int g = (int)(original.G + (128 - original.G) * ageFactor);
    int b = (int)(original.B + (128 - original.B) * ageFactor);
    int a = (int)(original.A * (1.0 - ageFactor * 0.5));
    return Color.FromArgb(a, r, g, b);
}
```

### Text Overlay on Icon

```csharp
Icon CreateTextIcon(string text, Color bg, Color fg, int size = 16)
{
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

    using var bgBrush = new SolidBrush(bg);
    g.FillEllipse(bgBrush, 0, 0, size - 1, size - 1);

    using var font = new Font("Segoe UI", size * 0.55f, FontStyle.Bold, GraphicsUnit.Pixel);
    using var fgBrush = new SolidBrush(fg);
    var measure = g.MeasureString(text, font);
    float x = (size - measure.Width) / 2f;
    float y = (size - measure.Height) / 2f;
    g.DrawString(text, font, fgBrush, x, y);

    IntPtr hIcon = bmp.GetHicon();
    var icon = (Icon)Icon.FromHandle(hIcon).Clone();
    DestroyIcon(hIcon);
    return icon;
}
```

## ApplicationContext Pattern

The standard pattern for a tray-only app with no main form:

```csharp
class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon notifyIcon;
    private readonly System.Windows.Forms.Timer pollTimer;

    public TrayApplicationContext()
    {
        notifyIcon = new NotifyIcon
        {
            Icon = CreateCircleIcon(Color.Gray),
            Text = "Initializing...",
            Visible = true,
            ContextMenuStrip = BuildContextMenu()
        };

        // Use WinForms Timer — fires on UI thread
        pollTimer = new System.Windows.Forms.Timer { Interval = 1000 };
        pollTimer.Tick += OnPollTick;
        pollTimer.Start();
    }

    private void OnPollTick(object? sender, EventArgs e)
    {
        // Safe to update UI directly — WinForms Timer fires on UI thread
        var state = ReadStateFromDisk();
        UpdateIcon(state.Color, state.Label);
    }

    protected override void ExitThreadCore()
    {
        pollTimer.Stop();
        pollTimer.Dispose();
        notifyIcon.Visible = false;
        notifyIcon.Icon?.Dispose();
        notifyIcon.ContextMenuStrip?.Dispose();
        notifyIcon.Dispose();
        base.ExitThreadCore();
    }
}
```

### Program.cs Entry Point

```csharp
[STAThread]
static void Main()
{
    bool createdNew;
    using var mutex = new Mutex(true, "Global\\MyTrayApp-{GUID}", out createdNew);
    if (!createdNew)
    {
        // Already running — optionally signal existing instance
        return;
    }

    Application.EnableVisualStyles();
    Application.SetHighDpiMode(HighDpiMode.SystemAware);
    Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new TrayApplicationContext());

    GC.KeepAlive(mutex);  // Prevent GC during Application.Run
}
```

## .NET 10 and AOT Considerations

- **WinForms AOT is experimental** in .NET 10. The `WinFormsComInterop` library provides COM wrappers needed for AOT compilation, but not all controls work.
- **NotifyIcon works** with AOT because it uses simple Win32 shell APIs, not heavy COM automation.
- **GDI+ works** with AOT — `System.Drawing.Common` is supported on Windows.
- **Trimming warnings**: `System.Drawing` may produce trim warnings. Suppress with `<TrimmerRootAssembly>` or use `[DynamicallyAccessedMembers]` attributes where needed.
- **PublishAot** in `.csproj`: `<PublishAot>true</PublishAot>` — test thoroughly, especially ContextMenuStrip event wiring which uses reflection internally.
- **Fallback**: If AOT causes issues, use `<PublishSingleFile>true</PublishSingleFile>` with `<SelfContained>true</SelfContained>` for a single-exe deployment without AOT restrictions.

## Quality Checklist

### Lifecycle & Disposal (12 items)

- [ ] **NotifyIcon.Visible = false** before dispose — prevents ghost icon
- [ ] **ExitThreadCore override** disposes all resources in correct order
- [ ] **Application.ApplicationExit** handler as safety net
- [ ] **Every Bitmap/Graphics/Pen/Brush/Font** in using statements
- [ ] **DestroyIcon called** for every GetHicon() result
- [ ] **Icon.FromHandle cloned** before DestroyIcon (clone owns its handle)
- [ ] **Old icon disposed** when replacing NotifyIcon.Icon
- [ ] **Mutex disposed** only after Application.Run returns
- [ ] **GC.KeepAlive(mutex)** after Application.Run
- [ ] **ContextMenuStrip disposed** in ExitThreadCore
- [ ] **Timer stopped and disposed** before NotifyIcon disposal
- [ ] **No icon references held** after disposal (nulled or cleared from caches)

### Thread Safety (8 items)

- [ ] **NotifyIcon created on UI thread** (in ApplicationContext constructor)
- [ ] **System.Windows.Forms.Timer** used for polling (not System.Threading.Timer)
- [ ] **Invoke/BeginInvoke** used for cross-thread UI updates
- [ ] **No direct UI access** from background threads or async continuations
- [ ] **SynchronizationContext captured** if using async/await patterns
- [ ] **ContextMenuStrip.Opening** used for dynamic menu updates (runs on UI thread)
- [ ] **File I/O on background thread** with results marshalled to UI
- [ ] **Lock or concurrent collection** for shared state between threads

### Icon Rendering (8 items)

- [ ] **Icon size matches SystemInformation.SmallIconSize** for DPI awareness
- [ ] **SmoothingMode.AntiAlias** set for circle/shape rendering
- [ ] **Transparent background** cleared before drawing
- [ ] **Border or outline** for visibility on both light and dark taskbars
- [ ] **Font size proportional** to icon size for text overlays
- [ ] **Text centered** using MeasureString for proper alignment
- [ ] **Icon cache** used for static/repeated icons to avoid GDI churn
- [ ] **High DPI tested** — icons render correctly at 100%, 125%, 150%, 200% scaling

### Notifications & UX (8 items)

- [ ] **BalloonTipClicked wired** before ShowBalloonTip
- [ ] **Tooltip text** set and under 127 characters
- [ ] **Tooltip updated** on state changes (hover shows current status)
- [ ] **Context menu has Exit** item that calls Application.Exit()
- [ ] **Double-click handler** for primary action (show/focus)
- [ ] **Single instance enforced** via named Mutex
- [ ] **Graceful startup** — icon appears with initial state, not blank
- [ ] **Error handling** — icon shows error state rather than crashing silently

### Architecture (6 items)

- [ ] **ApplicationContext pattern** used (no invisible Form hack)
- [ ] **[STAThread]** attribute on Main method
- [ ] **EnableVisualStyles** called before Application.Run
- [ ] **SetHighDpiMode** called before Application.Run
- [ ] **State file I/O** uses atomic write (write temp, rename) to prevent partial reads
- [ ] **Logging** for debugging tray icon issues (icon creation, disposal, state transitions)

## Common Pitfalls

**Ghost icons after crash:**
The OS only removes tray icons when the mouse hovers over them after the owning process dies. Always set `Visible = false` before exiting, and handle `ProcessExit` for unexpected termination.

**GDI handle exhaustion:**
A tray app updating icons every second leaks 1 GDI handle per update without proper DestroyIcon. At 10,000 handles (~2.7 hours), the app crashes. Always use the clone-and-destroy pattern.

**BalloonTip on Windows 10+:**
`ShowBalloonTip` creates an Action Center toast, not the classic balloon. The timeout parameter is ignored. The toast may be suppressed by Focus Assist / Do Not Disturb mode.

**AOT and ContextMenuStrip:**
ContextMenuStrip uses reflection internally for event routing. Test thoroughly under AOT — event handlers may not fire if the linker trims the reflection targets. Use `[DynamicDependency]` attributes if needed.

**PowerShell 5.1 UTF-8 BOM:**
If the tray app reads JSON state files written by PowerShell 5.1, be aware that `Set-Content -Encoding UTF8` writes a BOM. Use `[IO.File]::WriteAllText()` with `UTF8Encoding(false)` on the PowerShell side, or strip BOM bytes on the C# reader side.

## Success Indicators

You have successfully built a system tray app when:
- The icon appears immediately on startup with correct initial state
- Context menu responds to right-click with all items functional
- Icon updates do not leak GDI handles (verify in Task Manager over 30+ minutes)
- BalloonTip clicks navigate to the correct action
- The icon disappears cleanly on exit (no ghost)
- Only one instance can run at a time
- The app works correctly at 150% DPI scaling
- No cross-thread exceptions under any code path
