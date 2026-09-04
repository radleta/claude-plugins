---
tags: [wiki-memory/operations]
last-verified: "2026-08-25"
summary: "wiki-write test suites reuse payload files, making them incompatible with consume-on-success changes"
---

## wiki-write Test Suites Reuse One Payload File Across Many Invocations

`test-wiki-write.sh` and `test-wiki-health.sh` each create a payload file once
(`FULL_PAYLOAD`, `shared_payload`) and pass it to many successive `wiki-write`
calls. This makes the suites structurally incompatible with any change that
deletes the `--from` payload on success: the first call consumes it and every
later call fails `exit 3, payload file not found`.

Measured on an isolated copy with consume-on-success applied:
`test-wiki-write.sh` went 117 pass / 0 fail to 88 pass / 25 fail, and
`test-wiki-health.sh` hard-aborted at rc=3 after 79 of 190 assertions.

Also relevant when reading those suites: `test-wiki-health.sh` measured
**217 passed, 0 failed, exit 0** at HEAD `241929e` — it is not the source
of any baseline caution. The baseline caution that does still apply is
`wiki-health --all` exiting **6**, not 0, because `plan-expert` is a
pre-existing `partial-migration` domain; see
`scratch/marker-fences/baseline-wiki-health.txt` and
`plan-expert/wiki-health-baseline-gotcha.md`.

**Discovered:** Post-merge revalidation of a proposed wiki-write consume-on-success change.
**Impact:** Any future proposal to make wiki-write delete its own payload must
rewrite both suites first. The payload-reuse pattern is load-bearing, not incidental.
