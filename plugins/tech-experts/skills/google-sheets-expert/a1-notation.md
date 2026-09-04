---
tags: [google-sheets-expert/notation]
summary: "A1 notation reference: range syntax, sheet name quoting, and common patterns"
---

# A1 Notation Reference

| Notation | Meaning |
|----------|---------|
| `Sheet1!A1` | Single cell A1 on Sheet1 |
| `Sheet1!A1:D10` | Range A1 through D10 |
| `Sheet1!A:A` | Entire column A |
| `Sheet1!1:1` | Entire row 1 |
| `Sheet1!A1:D` | A1 to end of column D |
| `A1:D10` | Range on the first (default) sheet |
| `'My Sheet'!A1:B5` | Sheet name with spaces requires single quotes |

**Gotcha:** Sheet names containing spaces, special characters, or starting with a digit must be wrapped in single quotes. Forgetting quotes causes `400 Bad Request`.
