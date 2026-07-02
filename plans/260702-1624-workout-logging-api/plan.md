---
title: Everfit Workout Logging API (NestJS + PostgreSQL)
description: >-
  Home test: workout logging API with bulk log, filtered history, personal
  records. Features #4/#5 skipped per user.
status: completed
priority: P2
branch: ''
tags:
  - home-test
  - nestjs
  - postgresql
  - typeorm
blockedBy: []
blocks: []
created: '2026-07-02T09:35:00.245Z'
createdBy: 'ck:plan'
source: skill
---

# Everfit Workout Logging API (NestJS + PostgreSQL)

## Overview

Build Workout Logging API per Everfit home test. Scope: F1 log workout (bulk, multi-unit), F2 history (filters + keyset pagination + unit conversion), F3 personal records (max weight / max volume / best 1RM + time-range compare). Features #4 (progress chart) & #5 (insights) explicitly skipped.

Source brainstorm: `../reports/brainstorm-260702-1624-workout-logging-api-report.md`

**Locked decisions:** NestJS + PostgreSQL + TypeORM; `workout_entries.id` = UUIDv7 app-generated (index-friendly sequential inserts, user decision 2026-07-02); generated columns (`volume_kg`, `est_1rm_kg`) for indexed PR aggregation; keyset pagination; concurrent writes = independent valid events (append-only, transactional — NO idempotency key per user decision 2026-07-02; document rationale in README); `workout_date` DATE + `logged_at` TIMESTAMPTZ UTC; 2-tier seed (demo user + 50k perf user); small conventional commits (~17, tests interleaved).

**Grading-critical:** clean iterative git log; extensibility evidence = unit registry + config-driven muscle-group mapping; AI_WORKFLOW.md with real captured examples; `docker compose up` must fully work.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Scaffold & Docker](./phase-01-scaffold-docker.md) | Completed |
| 2 | [Database Schema & Migrations](./phase-02-database-schema-migrations.md) | Completed |
| 3 | [Units & Exercise Catalog](./phase-03-units-exercise-catalog.md) | Completed |
| 4 | [Workout Logging Endpoint](./phase-04-workout-logging-endpoint.md) | Completed |
| 5 | [Workout History Endpoint](./phase-05-workout-history-endpoint.md) | Completed |
| 6 | [Personal Records Endpoint](./phase-06-personal-records-endpoint.md) | Completed |
| 7 | [Tests & Seed Data](./phase-07-tests-seed-data.md) | Completed |
| 8 | [Production Readiness & Docs](./phase-08-production-readiness-docs.md) | Completed |

Dependency chain: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (linear; each phase = 1-3 commits).

## Acceptance Criteria (plan-level)

- `docker compose up` → migrated + seeded + healthy API, no manual steps.
- 3 endpoints handle all PDF edge cases with structured error envelope `{ error: { code, message, details } }`.
- History/PR on 50k-entry user provably indexed (EXPLAIN shows index scan).
- Unit tests: conversion round-trip, Epley 1RM, PR selection. Integration: endpoints + edge cases.
- Git log: small conventional commits, tests interleaved, no AI references.
- README (architecture diagram, setup, API docs, schema decisions, scale trade-offs) + AI_WORKFLOW.md (≥2 corrected AI mistakes, ≥1 rejected suggestion, prompting strategy).

## Dependencies

None (greenfield, no other unfinished plans).
