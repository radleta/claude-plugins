## Step: Extract `formatCurrency` helper function

Extract the inline currency formatting expression `(value / 100).toFixed(2)` that appears in three places in `InvoiceRenderer.tsx` into a single `formatCurrency(cents: number): string` helper in `utils/currency.ts`.

## Artifact: none

This step touches no state machine, decision table, or conditional logic. `formatCurrency` is a single-purpose pure function: it accepts one numeric input (`cents`) and always returns the same string output for the same input — no branching, no enum dispatch, no combinatorial inputs. The three call sites being consolidated are identical expressions; the extraction is a textual deduplication with no behavioral change. No runtime branching or conditional paths exist in either the original expressions or the extracted function.
