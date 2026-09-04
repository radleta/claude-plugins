## Step: Implement `processPayment` with full state machine and contract

Add the `processPayment(orderId, paymentMethod)` method to `PaymentService`. This method drives the payment state machine AND must satisfy the published method contract. Both the state transitions triggered by this method and its input/output contract are captured as artifacts.

## Artifacts

### state-matrix

| State \ Event          | `PaymentInitiated` | `PaymentSucceeded` | `PaymentFailed` | `PaymentTimeout` |
|------------------------|--------------------|--------------------|-----------------|-----------------|
| `PendingPayment`       | → `Processing`     | N/A                | N/A             | N/A             |
| `Processing`           | N/A                | → `Paid`           | → `Failed`      | → `PendingPayment` |
| `Paid`                 | N/A                | N/A                | N/A             | N/A             |
| `Failed`               | → `Processing`     | N/A                | N/A             | N/A             |

### method-contract

```typescript
// requires: orderId is a valid existing order in state PendingPayment or Failed
// requires: paymentMethod is a non-null PaymentMethod with valid card data
// ensures: on success — order transitions to Paid; returns PaymentResult with status=succeeded
// ensures: on failure — order transitions to Failed; returns PaymentResult with status=failed and errorCode
// ensures: on timeout — order returns to PendingPayment; returns PaymentResult with status=timeout
// throws: OrderNotFoundException when orderId does not exist
// throws: InvalidPaymentMethodException when paymentMethod fails card validation
```
