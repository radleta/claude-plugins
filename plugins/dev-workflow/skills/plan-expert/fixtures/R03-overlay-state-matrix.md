## Step: Fix IsDashboardHoverActive flag not clearing on button leave

Fix the bug where the `IsDashboardHoverActive` flag remains `true` after the user moves the mouse off a dashboard button, causing the hover overlay to persist after the cursor has left the active hit region.

The fix modifies the `MouseLeave` handler for dashboard buttons to clear `IsDashboardHoverActive` when the mouse leaves a button and the new cursor position is outside all valid hit regions. The three-way combination (`button` × `hit-region` × `IsDashboardHoverActive`) must be re-evaluated on every `MouseLeave` event to determine the correct post-leave state.

Specifically:
- If leaving `ButtonA` and cursor is in a hit-region of `ButtonB` → `IsDashboardHoverActive` stays `true`, overlay remains on `ButtonB`
- If leaving `ButtonA` and cursor is in the dashboard body (not a button hit-region) → `IsDashboardHoverActive` stays `true`, no button overlay
- If leaving `ButtonA` and cursor is outside the dashboard entirely → `IsDashboardHoverActive` set to `false`, overlay dismissed

This is a targeted fix to the `MouseLeave` handler only; `MouseEnter` behavior is unchanged.
