---
tags: [winforms-expert/context-menu]
summary: "Static and dynamic ContextMenuStrip patterns for system tray apps"
---

# ContextMenuStrip Patterns

## Static Menu

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

## Dynamic Submenus

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
