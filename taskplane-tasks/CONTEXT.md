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
| TP-002 | `ecosystem-updater-abstraction` | ✅ Complete | `EcosystemUpdater` interface + refactor npm/composer updaters + orchestrator registry loop |
| TP-003 | `scan-result-ecosystem-agnostic` | 🔵 Ready | Replace `ScanResultJson.php`/`.npm` hardcoded fields with `ecosystems: Record<string, EcosystemScanResult>` |

## Architecture Notes (added by TP-002)

- `src/phases/updater.ts` — new file; defines `EcosystemUpdater` interface and `UpdateContext`. Extension point for new package managers.
- `UPDATER_REGISTRY` in `src/phases/orchestrator.ts` — ordered array of updater singletons; adding a new ecosystem requires only implementing `EcosystemUpdater` and appending here.
- `OrchestratorResult` still uses named fields `npmUpdate`/`composerUpdate` (TODO for TP-003 to migrate to `updateResults: Record<string, UpdateResultJson>` once `ScanResultJson` is generalized).
- Gate B/C in `src/gates/validator.ts` no longer perform agent-identity checks; agent string is now purely informational metadata set by each updater.
- `getScanSlice()` in orchestrator is a bridge function that maps ecosystem names to `ScanResultJson.npm`/`.php` fields; this will be removed when TP-003 introduces `ecosystems: Record<string, EcosystemScanResult>`.

## Technical Debt / Future Work

- [ ] **OrchestratorResult generalization** — Migrate `npmUpdate`/`composerUpdate` named fields to `updateResults: Record<string, UpdateResultJson>` (discovered during TP-002, blocked on TP-003)
- [ ] **Remove getScanSlice() bridge** — Once TP-003 introduces `ScanResultJson.ecosystems`, remove the `getScanSlice()` helper in orchestrator.ts and update the registry loop to use `scanResult.ecosystems[updater.ecosystem]` directly
