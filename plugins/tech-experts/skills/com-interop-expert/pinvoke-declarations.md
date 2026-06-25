---
tags: [com-interop-expert/pinvoke]
summary: "P/Invoke declarations for User32 window management and process tree walking for terminal window detection"
---

# P/Invoke Declarations

## Window Management

```csharp
public static class NativeMethods
{
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo,
        [MarshalAs(UnmanagedType.Bool)] bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const int SW_SHOW = 5;
    public const int SW_RESTORE = 9;
    public const int SW_MINIMIZE = 6;
}
```

## Process Tree Walking for Terminal Windows

To find a terminal window (e.g., Windows Terminal, cmd, PowerShell) hosting a specific process:

1. Get the target process ID
2. Walk the parent process chain to find the terminal host
3. Use `EnumWindows` to find visible windows belonging to terminal PIDs
4. Filter by window class name (`CASCADIA_HOSTING_WINDOW_CLASS` for Windows Terminal)

```csharp
/// <summary>
/// Find the top-level window for a process, walking up the parent chain
/// to find terminal host windows.
/// </summary>
public static IntPtr FindTerminalWindow(int processId)
{
    IntPtr result = IntPtr.Zero;

    // Try the process itself first
    EnumWindows((hWnd, _) =>
    {
        GetWindowThreadProcessId(hWnd, out int pid);
        if (pid == processId && IsWindowVisible(hWnd))
        {
            result = hWnd;
            return false; // stop enumeration
        }
        return true;
    }, IntPtr.Zero);

    if (result != IntPtr.Zero) return result;

    // Walk parent process chain for terminal hosts
    try
    {
        var process = Process.GetProcessById(processId);
        // Use WMI or NtQueryInformationProcess to find parent PID
        // Then search for windows belonging to parent
    }
    catch (ArgumentException)
    {
        // Process exited
    }

    return result;
}
```
