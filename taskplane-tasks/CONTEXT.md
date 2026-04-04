# General — Context

**Last Updated:** 2026-04-04
**Status:** Active
**Next Task ID:** TP-004

---

## Current State

This is the default task area for osv-security-cli. Tasks that don't belong
to a specific domain area are created here.

Taskplane is configured. As tarefas ativas estão relacionadas à introdução de abstração para os updaters de pacotes.

Use `/task` for single tasks or `/orch all` for parallel batch execution.

---

## Key Files

| Category | Path |
|----------|------|
| Tasks | `taskplane-tasks/` |
| Config | `.pi/task-runner.yaml` |
| Config | `.pi/task-orchestrator.yaml` |

---

## Active Tasks

| ID | Slug | Status | Summary |
|----|------|--------|---------|
| TP-002 | `ecosystem-updater-abstraction` | 🔵 Ready | `EcosystemUpdater` interface + refactor npm/composer updaters + orchestrator registry loop |
| TP-003 | `scan-result-ecosystem-agnostic` | 🔵 Ready (blocked on TP-002) | Replace `ScanResultJson.php`/`.npm` hardcoded fields with `ecosystems: Record<string, EcosystemScanResult>` |

## Technical Debt / Future Work

_Items discovered during task execution are logged here by agents._
