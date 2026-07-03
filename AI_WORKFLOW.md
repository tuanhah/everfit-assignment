# AI Workflow Log

## Tools

**Claude Code (Opus 4.8)** end-to-end: requirements analysis, architecture
brainstorming, planning, code generation, test writing, debugging, and this
documentation. No other AI tools were used.

## Process

The work ran through an explicit pipeline rather than ad-hoc prompting:

1. **Brainstorm** — fed the assignment PDF to the agent, debated stack, schema
   and scope trade-offs interactively. Output: a decision record
   (`plans/reports/brainstorm-*.md`) with every choice + rationale.
2. **Plan** — turned decisions into 8 phase files
   (`plans/260702-1624-workout-logging-api/`), each with concrete file lists,
   implementation steps, success criteria and planned commit messages.
3. **Implement** — one phase at a time. Every phase ended with live
   verification (curl smoke tests against a running app, `EXPLAIN ANALYZE`
   in real Postgres, unit/e2e runs) before its commit — nothing was committed
   on faith.
4. Decision changes mid-flight (dropping idempotency keys, switching to
   UUIDv7) were propagated back into the plan files first, then implemented —
   the plan stayed the source of truth.

## AI Output That Was Wrong or Suboptimal (and the fixes)

### 1. ESM-only `uuid` package broke the test suite

The AI initially generated UUIDv7 ids via the `uuid` npm package. The app
built and ran fine — but the entire e2e suite failed to even compile: the
`uuid` package ships pure ESM, which Jest's CommonJS runtime can't import.
Instead of patching Jest with transform hacks, I had the AI replace the
dependency with a small local implementation on Node's built-in `crypto`
(`src/common/uuidv7.ts`). One less dependency, no test-runner hacks.

### 2. Over-specified test assumption about id ordering

An AI-written e2e test asserted that within one bulk request, the *second*
exercise (Squat) would appear first in history — reasoning that its UUIDv7 id
is generated later and sorts higher. The test failed intermittently: both ids
are generated in the **same millisecond**, so their 48-bit timestamps are
identical and the 74 random bits decide the order. Manual smoke tests had
"confirmed" the wrong assumption by luck. The fix asserts what the API
actually guarantees (all same-date entries precede older dates) and looks the
Squat entry up by name instead of position. A good reminder that
time-ordered ≠ strictly ordered.

### 3. `.gitignore` silently excluded the lockfile

The repo template has ignored `package-lock.json`.
For a backend service the lockfile is required for reproducible
`npm ci`/Docker builds, so the ignore line was removed before anything was
committed. Small, but it would have quietly broken `docker compose up` for
any reviewer.

## Rejected AI Suggestions (and why)

### Idempotency keys for concurrent writes — rejected

The AI's initial design answered the assignment's "concurrent writes" edge
case with client idempotency keys + a partial unique index + payload-hash
comparison + a 409 conflict path. I rejected the whole mechanism: workout
logging is **append-only** — there is no read-modify-write, so no lost
updates are possible, and two identical sets on the same day are legitimate
gym data that must *not* be deduped silently. A transaction already provides
the only guarantee that matters (bulk atomicity). The concurrency story
became a design argument instead of a mechanism — less code, fewer failure
modes, documented in the README with idempotency keys named as the extension
point if client-retry dedup ever becomes a requirement.

### Hard foreign keys — rejected against the AI's recommendation

The reverse case: the AI generated (and argued to keep) `REFERENCES`
constraints with `ON DELETE CASCADE`. I overruled it and moved to soft
references enforced at the application layer. The cost of hard FKs is real
on a write-heavy path: every child INSERT triggers an index lookup on the
parent table to verify the referenced row exists, and takes a row-level
share lock on that parent row for the duration of the transaction — so
concurrent bulk inserts referencing the same parent queue up on that lock.
None of that buys anything here: this codebase's write path only inserts
ids it resolved or created within the same request, and there are no delete
endpoints, so the orphan scenarios FKs guard against can't occur. Dropping
them also keeps the schema partition-ready (Postgres FKs cannot span
partitions). The AI pushed back with the integrity trade-offs (orphan risk,
manual child-first deletes), which are real and are documented in the
README — but the decision is mine, and disagreeing with the tool's
recommendation while owning the consequences is part of using it well.


## Prompting Strategy

- **Rules files over repeated instructions**: project conventions
  (YAGNI/KISS/DRY, commit format, verification gates) live in
  `.claude/rules/*.md`, loaded automatically each session.
- **Full context up front, small tasks after**: the whole PDF went in first;
  implementation prompts were then phase-scoped ("continue with phase 5"),
  with each phase file carrying exactly the context that phase needs.
- **Decisions captured outside the chat**: brainstorm report + plan files
  mean any session (or human) can pick up where the last one stopped without
  replaying the conversation.
- **Verify before commit, every time**: the agent ran curl smoke tests, DB
  spot-checks (`\d`, constraint-violation INSERTs, `EXPLAIN ANALYZE`) and the
  test suites before each commit; failures (the ESM one, the tiebreak one)
  were debugged in-session rather than papered over.
- **Small conventional commits** mapped 1:1 to plan phases, so the git log
  reads as the implementation narrative.
