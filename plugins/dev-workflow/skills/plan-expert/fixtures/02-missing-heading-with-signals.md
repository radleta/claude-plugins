## Step: Fix consensus stall detection

Modify state machine X with new transition to handle the edge case where a review request stalls when the last reviewer is also the submitter. The current logic does not account for the self-review exclusion, causing permanent stall in the `PendingReview` state.

The fix adds a transition from `PendingReview` to `ConsensusStalled` when the only remaining reviewer matches the submitter's user ID. From `ConsensusStalled`, the system can transition to `Escalated` (admin override) or back to `PendingReview` (reviewer reassignment). The state change logic depends on the reviewer roster after self-exclusion.
