---
owner: platform
last_updated: 2026-04-11
read_when:
  - starting work in this repository
  - choosing which docs to read before implementation
  - onboarding new human/agent contributors
---

# Docs Index

Canonical docs map for Clipify.
Use this file first, then follow `read_when` hints in linked docs.
Clipify is in active development: do not keep compatibility layers; remove obsolete behavior instead.

Quick command:

- `bun run docs:list` (or `bin/docs-list`) prints the same read-order map and `read_when` hints in terminal-friendly format.

## Read Order (Session Start)

1. `README.md`
2. `docs/architecture.md`
3. `docs/backend-architecture-standard.md`
4. `docs/api-compatibility.md`
5. `docs/local-dev-agent-handoff.md` (when resuming local development)

## Platform and Delivery

1. `docs/cicd-railway-github-setup.md`
2. `docs/release.md`
3. `docs/operations.md`
4. `docs/local-dev-agent-handoff.md`

## Stack and Planning

1. `docs/bun-ecosystem-plan.md`

## Decision Rule

1. Behavior/policy truths live in docs.
2. Skills are wrappers for repeat operations and must link to docs.
3. If docs and code differ, fix docs in the same PR that changes code.
