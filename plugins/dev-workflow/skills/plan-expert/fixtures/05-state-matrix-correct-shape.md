## Step: Implement user account lifecycle state machine

Add the `UserAccountStateMachine` class that manages user account lifecycle transitions. The state machine governs all valid state changes and their triggering events.

## Artifact: state-matrix

| State \ Event         | `EmailVerified` | `AdminApproved` | `TrialExpired` | `PaymentReceived` | `AccountSuspended` | `AccountDeleted` |
|-----------------------|-----------------|-----------------|----------------|-------------------|--------------------|-----------------|
| `Unverified`          | → `Pending`     | N/A             | N/A            | N/A               | N/A                | → `Deleted`     |
| `Pending`             | N/A             | → `Active`      | → `Expired`    | N/A               | N/A                | → `Deleted`     |
| `Active`              | N/A             | N/A             | N/A            | N/A               | → `Suspended`      | → `Deleted`     |
| `Suspended`           | N/A             | → `Active`      | N/A            | → `Active`        | N/A                | → `Deleted`     |
| `Expired`             | N/A             | N/A             | N/A            | → `Active`        | N/A                | → `Deleted`     |
| `Deleted`             | N/A             | N/A             | N/A            | N/A               | N/A                | N/A             |
