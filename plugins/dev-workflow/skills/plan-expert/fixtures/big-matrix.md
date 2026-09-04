# Order Fulfillment State Machine — Full Reference

This file is the authoritative state matrix for the order fulfillment workflow. Referenced by plan-step fixtures via `artifact-ref: ./big-matrix.md`.

| State \ Event           | `OrderPlaced` | `PaymentReceived` | `PaymentFailed` | `ShipOrder` | `DeliveryConfirmed` | `OrderCancelled` | `RefundRequested` | `RefundProcessed` |
|-------------------------|---------------|-------------------|-----------------|-------------|---------------------|-----------------|-------------------|-------------------|
| `Created`               | → `PendingPayment` | N/A           | N/A             | N/A         | N/A                 | → `Cancelled`   | N/A               | N/A               |
| `PendingPayment`        | N/A           | → `Processing`    | → `PaymentFailed` | N/A       | N/A                 | → `Cancelled`   | N/A               | N/A               |
| `PaymentFailed`         | N/A           | → `Processing`    | N/A             | N/A (guard) | N/A                 | → `Cancelled`   | N/A               | N/A               |
| `Processing`            | N/A           | N/A               | → `PaymentFailed` | → `Shipped` | N/A                | → `Cancelled`   | N/A               | N/A               |
| `Shipped`               | N/A           | N/A               | N/A             | N/A         | → `Delivered`       | N/A             | N/A               | N/A               |
| `Delivered`             | N/A           | N/A               | N/A             | N/A         | N/A                 | N/A             | → `RefundPending` | N/A               |
| `RefundPending`         | N/A           | N/A               | N/A             | N/A         | N/A                 | N/A             | N/A               | → `Refunded`      |
| `Refunded`              | N/A           | N/A               | N/A             | N/A         | N/A                 | N/A             | N/A               | N/A               |
| `Cancelled`             | N/A           | N/A               | N/A             | N/A         | N/A                 | N/A             | N/A               | N/A               |
