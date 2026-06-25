## Step: Fix consensus stall detection for promotion eligibility

Fix the bug where the promotion path evaluation incorrectly handles the combinatorial case where a user's `Status` is `Standard`, their `StatusSince` bucket is in the 30-60 day range, and their `LastTeammateAt` bucket is `>7days`. In this cell of the state matrix, the user should NOT be promoted yet — but the current code promotes them because the StatusSince threshold check fires before the LastTeammateAt exclusion.

The fix modifies the promotion-path eligibility logic to evaluate the three-way combination (`Status` × `StatusSince bucket` × `LastTeammateAt bucket`) atomically rather than sequentially. The sequential evaluation allows early-exit on StatusSince without applying the LastTeammateAt guard.

Affected cells in the current state machine: all rows where `Status = Standard` AND `StatusSince in [30, 60)` — the fix adds an explicit guard for the `LastTeammateAt > 7days` exclusion in each of those cells. No change to the `StatusSince >= 60` rows; no change to `Status = Trial` or `Status = Premium` rows.
