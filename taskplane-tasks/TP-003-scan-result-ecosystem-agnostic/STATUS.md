# TP-003: ScanResultJson Ecosystem-Agnostic Refactor — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-04-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code
> changes. Workers expand steps when runtime discoveries warrant it — aim for
> 2-5 outcome-level items per step, not exhaustive implementation scripts.

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] TP-002 `.DONE` marker confirmed
- [ ] Required source files read and understood
- [ ] Baseline test suite passing

---

### Step 1: Update ScanResultJson Type
**Status:** ⬜ Not Started

- [ ] `ScanResultJson.ecosystems: Record<string, EcosystemScanResult>` replaces `php`/`npm` fields
- [ ] `VulnerabilityEntry.ecosystem` widened to `string`
- [ ] `Ecosystem` type in `common.ts` updated
- [ ] Type-check surfaces all consumers to fix

---

### Step 2: Update Scanner Output
**Status:** ⬜ Not Started

- [ ] Scanner produces `ecosystems: { composer: ..., npm: ... }`
- [ ] `osv-commands.ts` updated if needed

---

### Step 3: Update Orchestrator Consumers
**Status:** ⬜ Not Started

- [ ] `scanResult.php` / `scanResult.npm` accesses replaced with `ecosystems[key]`
- [ ] Registry loop uses `updater.ecosystem` as key

---

### Step 4: Update Gate A Validator
**Status:** ⬜ Not Started

- [ ] `ScanResultSchema` uses `z.record(EcosystemScanResultSchema)` for `ecosystems`
- [ ] Targeted gate tests pass

---

### Step 5: Update Report Layer
**Status:** ⬜ Not Started

> ⚠️ Hydrate: Expand after reading report files — scope depends on how deeply they access scan result fields

- [ ] `consolidated.ts` and `executive.ts` updated if they access `php`/`npm` fields directly

---

### Step 6: Update Test Fixtures
**Status:** ⬜ Not Started

- [ ] `scan-result-success.json` updated to new shape
- [ ] `scan-result-error.json` updated to new shape
- [ ] Inline test constructions updated

---

### Step 7: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] All failures fixed
- [ ] Build passes

---

### Step 8: Documentation & Delivery
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

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
