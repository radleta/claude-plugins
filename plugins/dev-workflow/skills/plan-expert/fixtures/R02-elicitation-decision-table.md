## Step: Fix notification dispatch case-sensitivity bug in elicitation flow

Fix the bug where notification dispatch for `DirectMessage` subtype fails with case-sensitive match on the `condition` field. The dispatch logic performs an exact string comparison for each Notification subtype × condition mapping, and production data contains mixed-case condition values that don't match the lowercase comparison.

The fix updates the dispatch handler to normalize condition values to lowercase before the comparison. This affects all 4 Notification subtype × condition rows:

- `DirectMessage` × `unread` → dispatch to `DirectMessageUnreadHandler`
- `DirectMessage` × `mention` → dispatch to `DirectMessageMentionHandler`
- `TeamUpdate` × `new_member` → dispatch to `TeamUpdateNewMemberHandler`
- `TeamUpdate` × `role_change` → dispatch to `TeamUpdateRoleChangeHandler`
- `SystemAlert` × `maintenance` → dispatch to `SystemAlertMaintenanceHandler`
- `SystemAlert` × `outage` → dispatch to `SystemAlertOutageHandler`

Each handler must be called exactly once per matching notification; duplicate dispatch on the same notification ID is a correctness violation. The fix must not change the routing table — only the pre-comparison normalization step.
