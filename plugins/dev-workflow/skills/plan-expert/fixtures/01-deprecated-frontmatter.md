---
design-step: true
---

## Step: Add status transitions for user onboarding flow

Update the user onboarding state machine to add a new transition from `PendingVerification` to `Verified` when the email confirmation is received. Also handle the edge case where the user's session expires mid-verification, adding a `VerificationExpired` transition back to `Unverified`.

The new transition logic fires based on the `EmailConfirmedAt` timestamp and the `SessionExpiresAt` field. If both are set and `EmailConfirmedAt < SessionExpiresAt`, the transition goes to `Verified`; otherwise to `VerificationExpired`.
