---
artifact-ref: ./does-not-exist.md
---

## Step: Fix race condition in payment processing state machine

Fix the race condition where two concurrent payment attempts can both transition an order from `PendingPayment` to `PaymentProcessing`, resulting in double-charges. The full state machine lives in the referenced file.

## Artifact: state-matrix
