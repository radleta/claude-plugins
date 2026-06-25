# Order Status State Machine — Full Reference

This file is the authoritative state matrix for the order status workflow, used as the reference file for fixtures with `artifact-ref: ./matrix.md`.

| State \ Event           | `ItemShipped` | `AllItemsShipped` | `OrderCancelled` | `ReturnRequested` |
|-------------------------|---------------|-------------------|-----------------|-------------------|
| `Created`               | N/A           | N/A               | → `Cancelled`   | N/A               |
| `Processing`            | → `PartiallyFulfilled` | → `Fulfilled` | → `Cancelled` | N/A           |
| `PartiallyFulfilled`    | N/A (self)    | → `Fulfilled`     | → `Cancelled`   | N/A               |
| `Fulfilled`             | N/A           | N/A               | N/A             | → `ReturnPending` |
| `ReturnPending`         | N/A           | N/A               | N/A             | N/A               |
| `Cancelled`             | N/A           | N/A               | N/A             | N/A               |
