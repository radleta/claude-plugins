## Step: Update subscription renewal state machine

Update the subscription renewal logic to handle the new grace-period state. When a subscription expires, users enter a grace period before full deactivation. During grace period, the subscription is still usable but the user sees renewal prompts.

## Artifact: state-matrix

The subscription state machine starts in the Active state. When the billing cycle ends and renewal fails, the subscription transitions to a grace period of 14 days. During the grace period, the subscription continues to function normally but the user sees a prominent renewal banner. If the user pays during grace period, the subscription returns to Active. If grace period expires with no payment, the subscription moves to Suspended. From Suspended, the user can reactivate within 30 days; after 30 days the subscription is Cancelled and cannot be reactivated without a fresh signup.
