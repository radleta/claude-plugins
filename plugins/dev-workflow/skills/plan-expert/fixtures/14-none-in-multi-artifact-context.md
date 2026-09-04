## Step: Implement dashboard hover state transitions

Add the dashboard hover state machine to `DashboardController`. The state machine governs `IsDashboardHoverActive` in combination with button and hit-region interactions.

## Artifacts

### state-matrix

| State \ Event          | `MouseEnterButton` | `MouseLeaveButton` | `MouseEnterDashboard` | `MouseLeaveDashboard` |
|------------------------|--------------------|--------------------|-----------------------|-----------------------|
| `DashboardInactive`    | N/A                | N/A                | → `DashboardHovering` | N/A                   |
| `DashboardHovering`    | → `ButtonHovering` | N/A                | N/A                   | → `DashboardInactive` |
| `ButtonHovering`       | N/A                | → `DashboardHovering` | N/A                | → `DashboardInactive` |

### none

The controller initialization code sets `IsDashboardHoverActive = false` on construction. This is a single-purpose pure function with deterministic output and no combinatorial inputs.
