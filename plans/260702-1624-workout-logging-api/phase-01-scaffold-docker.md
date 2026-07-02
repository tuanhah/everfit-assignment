---
phase: 1
title: Scaffold & Docker
status: completed
effort: 2h
priority: P1
dependencies: []
---

# Phase 1: Scaffold & Docker

## Overview

Init git repo + NestJS project with config management, linting, and docker compose (Postgres + app). Foundation for iterative commits — `git init` MUST be first action (evaluators review log from commit 1).

## Requirements

- Functional: runnable NestJS app skeleton; `docker compose up` boots app + Postgres.
- Non-functional: `.env`-driven config via `@nestjs/config`; no secrets committed.

## Architecture

- Nest CLI scaffold, strict TypeScript, ESLint + Prettier (Nest defaults, don't over-tune).
- `docker-compose.yml`: `postgres:16-alpine` (healthcheck) + `app` (multi-stage Dockerfile, depends_on healthy PG, runs migrations then starts).
- Config module: `DATABASE_URL` (or PG_* parts), `PORT`, `NODE_ENV`. `.env.example` committed, `.env` gitignored (already covered by existing `.gitignore`).

## Related Code Files

- Create: `package.json`, `tsconfig*.json`, `nest-cli.json`, `.eslintrc`/`eslint.config`, `src/main.ts`, `src/app.module.ts`, `src/config/` (env validation), `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore`
- Modify: none (greenfield)

## Implementation Steps

1. `git init` in project root. NOTE: repo root already has `.claude/`, `plans/`, `.gitignore`, `release-manifest.json` — commit app code only; keep first commit scoped to scaffold (decide whether to commit `.claude`/`plans` — recommend YES for AI-workflow evidence, it strengthens the AI-first grading criterion).
2. Scaffold NestJS project (nest new in-place or manual package.json), strict TS.
3. Add `@nestjs/config` with env validation (joi or zod — pick one, joi is Nest-conventional).
4. Write multi-stage `Dockerfile` (build → slim runtime) + `.dockerignore`.
5. Write `docker-compose.yml`: PG16 with healthcheck + volume; app waits for healthy PG.
6. Verify: `docker compose up` → app responds on PORT; local `npm run start:dev` also works against compose PG.

**Commits:**
- `chore: scaffold nestjs project with config and linting`
- `chore: add docker compose with postgres and app service`

## Success Criteria

- [ ] `docker compose up` boots app + Postgres with healthcheck, no manual steps
- [ ] `npm run lint` and `npm run build` pass
- [ ] `.env.example` present; no secrets in git
- [ ] 2 focused commits in log

## Risk Assessment

- Node/PG version drift → pin versions (node:22-alpine, postgres:16-alpine).
- App starts before PG ready → healthcheck + `depends_on: condition: service_healthy`.
