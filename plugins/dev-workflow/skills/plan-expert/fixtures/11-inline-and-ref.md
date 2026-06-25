---
artifact-ref: ./matrix.md
---

## Step: Extend order status state machine with new `PartiallyFulfilled` state

Add the new `PartiallyFulfilled` state to the order fulfillment state machine. An order enters `PartiallyFulfilled` when some line items are shipped but others are still pending. The full state machine is maintained in the referenced file; this step's inline table provides the transitions for the new state only.

## Artifact: state-matrix

| State \ Event            | `ItemShipped` | `AllItemsShipped` | `OrderCancelled` |
|--------------------------|---------------|-------------------|-----------------|
| `PartiallyFulfilled`     | N/A (self)    | → `Fulfilled`     | → `Cancelled`   |
