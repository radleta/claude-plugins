---
tags: [winforms-expert/application-context]
summary: "Standard ApplicationContext pattern for tray-only WinForms apps with no main form"
---

# ApplicationContext Pattern

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

## Program.cs Entry Point

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
