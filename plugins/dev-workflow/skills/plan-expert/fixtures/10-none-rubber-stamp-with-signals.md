## Step: Fix promotion logic for user status upgrade

Update the promotion path logic to correctly handle the transition from `Standard` to `Premium` status. The current code incorrectly evaluates the StatusSince bucket and LastTeammateAt bucket when determining eligibility, causing some users to be promoted too early.

## Artifact: none

Pure refactor.
