# TP-002: EcosystemUpdater Interface and Updater Refactor — Status

**Current Step:** Step 0: Preflight
**Status:** 🟡 In Progress
**Last Updated:** 2026-04-04
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 1
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code
> changes. Workers expand steps when runtime discoveries warrant it — aim for
> 2-5 outcome-level items per step, not exhaustive implementation scripts.

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required source files read and understood
- [x] Baseline test suite passing

---

### Step 1: Define EcosystemUpdater Interface
**Status:** ⬜ Not Started

- [ ] `UpdateContext` interface created in `src/phases/updater.ts`
- [ ] `EcosystemUpdater` interface created in `src/phases/updater.ts`

---

### Step 2: Refactor NpmUpdater
**Status:** ⬜ Not Started

- [ ] `NpmUpdater` implements `EcosystemUpdater` with `ecosystem`, `lockFiles`, `isConfigured`, `run`
- [ ] Singleton exported from `npm-updater.ts`
- [ ] Targeted tests pass

---

### Step 3: Refactor ComposerUpdater
**Status:** ⬜ Not Started

- [ ] `ComposerUpdater` implements `EcosystemUpdater` with `ecosystem`, `lockFiles`, `isConfigured`, `run`
- [ ] Singleton exported from `composer-updater.ts`
- [ ] Targeted tests pass

---

### Step 4: Refactor Orchestrator to Use Registry
**Status:** ⬜ Not Started

- [ ] `UPDATER_REGISTRY` array defined with npm and composer updaters
- [ ] Hardcoded phase blocks replaced with registry loop
- [ ] Loop skips unconfigured updaters and empty scan results
- [ ] Gate validation preserved per ecosystem
- [ ] Integration tests pass

---

### Step 5: Update Types and Gate Validators
**Status:** ⬜ Not Started

- [ ] `UpdateResultJson.agent` widened to `string`
- [ ] `UpdateResultSchema.agent` updated in validator
- [ ] Gate B/C agent-identity checks updated or removed
- [ ] Unit tests pass

---

### Step 6: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] All failures fixed
- [ ] Build passes

---

### Step 7: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] `taskplane-tasks/CONTEXT.md` updated
- [ ] Discoveries logged

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-04-04 | Task staged | PROMPT.md and STATUS.md created |
| 2026-04-04 03:11 | Task started | Runtime V2 lane-runner execution |
| 2026-04-04 03:11 | Step 0 started | Preflight |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
