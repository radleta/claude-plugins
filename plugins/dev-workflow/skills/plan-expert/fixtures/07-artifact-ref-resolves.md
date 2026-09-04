---
artifact-ref: ./big-matrix.md
---

## Step: Fix invalid state transition in order fulfillment workflow

Fix the bug where an order in `PaymentFailed` state incorrectly accepts a `ShipOrder` event, bypassing the payment retry logic. The full state machine is in the referenced file; this fix adds a guard on the `ShipOrder` event handler to reject the transition when `state == PaymentFailed`.

## Artifact: state-matrix
