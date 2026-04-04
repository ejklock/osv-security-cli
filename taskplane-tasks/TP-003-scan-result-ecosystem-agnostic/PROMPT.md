# Task: TP-003 - ScanResultJson Ecosystem-Agnostic Refactor

**Created:** 2026-04-04
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** This change cascades across scanner, orchestrator, updaters, gates, and reports — a type change to `ScanResultJson` touches every consumer and requires both a plan review (to validate the new schema design) and a code review (to catch consumer regressions).
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-003-scan-result-ecosystem-agnostic/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

`ScanResultJson` today has two hardcoded fields — `php` and `npm` — which means every new ecosystem forces a type change and a cascade update across all consumers. This task replaces those fields with a generic `ecosystems: Record<string, EcosystemScanResult>` map, making the scan result self-describing and extensible.

After this task, adding pip or cargo scan support means only the scanner and the new updater need to change — the orchestrator, gates, and report layer work off the dynamic map without modification.

## Dependencies

- **Task:** TP-002 (EcosystemUpdater interface must exist; orchestrator must use registry loop before this refactor can cleanly update the scan result accessor)

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

## Environment

- **Workspace:** `src/types/`, `src/phases/`, `src/gates/`, `src/report/`
- **Services required:** None

## File Scope

- `src/types/scan.ts`
- `src/types/common.ts`
- `src/phases/scanner.ts`
- `src/utils/osv-commands.ts`
- `src/phases/orchestrator.ts`
- `src/gates/validator.ts`
- `src/report/consolidated.ts`
- `src/report/executive.ts`
- `tests/fixtures/scan-result-success.json`
- `tests/fixtures/scan-result-error.json`
- `tests/unit/gates/validator.test.ts`
- `tests/integration/orchestrator.test.ts`

## Steps

### Step 0: Preflight

- [ ] TP-002 is complete (`.DONE` marker exists in `taskplane-tasks/TP-002-ecosystem-updater-abstraction/`)
- [ ] Read `src/types/scan.ts`, `src/phases/scanner.ts`, `src/gates/validator.ts`, `src/phases/orchestrator.ts`, `src/report/consolidated.ts`, and both scan fixture files
- [ ] Run full test suite to confirm TP-002 baseline: `npm test`

### Step 1: Update ScanResultJson Type

Update `src/types/scan.ts`:

- [ ] Replace `php: EcosystemScanResult` and `npm: EcosystemScanResult` fields with `ecosystems: Record<string, EcosystemScanResult>`
- [ ] Update `VulnerabilityEntry.ecosystem` from `'composer' | 'npm'` to `string` (or keep the union as a nominal hint but widen the type — decide based on what causes fewest downstream breaks)
- [ ] Update `src/types/common.ts`: widen `Ecosystem` type from `'php' | 'npm'` to `string`, or remove it if no longer meaningful as a union
- [ ] Run `npm run build` (type-check only goal) to surface all consumers that need updating

**Artifacts:**
- `src/types/scan.ts` (modified)
- `src/types/common.ts` (modified)

### Step 2: Update Scanner Output

Update `src/phases/scanner.ts`:

- [ ] Change the function that builds `ScanResultJson` to populate `ecosystems: { composer: ..., npm: ... }` instead of `php: ..., npm: ...`
  - Note: the key should be the ecosystem identifier as OSV reports it — `'composer'` and `'npm'` (matching `VulnerabilityEntry.ecosystem`), not the runtime language name `'php'`
- [ ] Update `emptyEcosystem()` usage accordingly
- [ ] Verify `buildScanCommand` in `src/utils/osv-commands.ts` still works — it receives boolean flags for php/npm presence; update if the function signature needs to align with the new ecosystem keys

**Artifacts:**
- `src/phases/scanner.ts` (modified)
- `src/utils/osv-commands.ts` (modified if needed)

### Step 3: Update Orchestrator Consumers

Update `src/phases/orchestrator.ts`:

- [ ] Replace `scanResult.php` and `scanResult.npm` accesses with `scanResult.ecosystems['composer']` and `scanResult.ecosystems['npm']`
- [ ] Update the registry loop introduced in TP-002: each `EcosystemUpdater` has an `ecosystem` string — use `scanResult.ecosystems[updater.ecosystem]` to extract the right slice for `UpdateContext.scanResult`
- [ ] Update `hasNpmUpdates` / `hasPhpUpdates` logic to use the new accessor (or generalize to iterate over ecosystems)
- [ ] Update the summary log line that reads `scanResult.php.vulnerabilities_total` and `scanResult.npm.vulnerabilities_total`

**Artifacts:**
- `src/phases/orchestrator.ts` (modified)

### Step 4: Update Gate A Validator

Update `src/gates/validator.ts`:

- [ ] Replace `ScanResultSchema`'s hardcoded `php` and `npm` fields with `ecosystems: z.record(z.string(), EcosystemScanResultSchema)` (or `z.record(EcosystemScanResultSchema)`)
- [ ] Gate A validation logic that checks for error status remains unchanged — only the schema shape changes
- [ ] Run targeted tests: `npm test -- --reporter=verbose tests/unit/gates/`

**Artifacts:**
- `src/gates/validator.ts` (modified)

### Step 5: Update Report Layer

- [ ] Audit `src/report/consolidated.ts` and `src/report/executive.ts` for any direct reads of `scanResult.php` or `scanResult.npm`
- [ ] Update those reads to use `scanResult.ecosystems['composer']` and `scanResult.ecosystems['npm']` (or iterate over all ecosystems if the template already supports it)
- [ ] Verify Handlebars templates in `src/report/templates/` do not hardcode `php`/`npm` field names — update if they do

**Artifacts:**
- `src/report/consolidated.ts` (modified if needed)
- `src/report/executive.ts` (modified if needed)

### Step 6: Update Test Fixtures

- [ ] Update `tests/fixtures/scan-result-success.json` — replace top-level `php` and `npm` keys with `ecosystems: { "composer": {...}, "npm": {...} }`
- [ ] Update `tests/fixtures/scan-result-error.json` — same shape change
- [ ] Update any test that constructs a `ScanResultJson` inline to use the new shape

**Artifacts:**
- `tests/fixtures/scan-result-success.json` (modified)
- `tests/fixtures/scan-result-error.json` (modified)

### Step 7: Testing & Verification

- [ ] Run FULL test suite: `npm test`
- [ ] Run build: `npm run build`
- [ ] Fix all failures

### Step 8: Documentation & Delivery

- [ ] Update `taskplane-tasks/CONTEXT.md` — log the ScanResultJson schema change
- [ ] Log discoveries in STATUS.md Discoveries table

## Documentation Requirements

**Must Update:**
- `taskplane-tasks/CONTEXT.md` — log schema change and ecosystem key naming convention (`'composer'` not `'php'`)

**Check If Affected:**
- `src/config/schema.ts` — check if scan result shape is referenced in config validation
- `src/index.ts` — check if `ScanResultJson` is re-exported and public API is affected

## Completion Criteria

- [ ] `ScanResultJson.ecosystems` is a `Record<string, EcosystemScanResult>` — no more hardcoded `php`/`npm` fields
- [ ] Scanner produces `{ ecosystems: { composer: ..., npm: ... } }`
- [ ] All consumers updated (orchestrator, gates, report)
- [ ] Test fixtures updated
- [ ] All tests passing
- [ ] Build passes

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(TP-003): complete Step N — description`
- **Bug fixes:** `fix(TP-003): description`
- **Tests:** `test(TP-003): description`
- **Hydration:** `hydrate: TP-003 expand Step N checkboxes`

## Do NOT

- Change `EcosystemScanResult` structure itself — only how it's keyed in `ScanResultJson`
- Add new ecosystem scan support (pip, cargo) — only make the shape generic
- Rename the ecosystem keys arbitrarily — use OSV's ecosystem identifiers (`'composer'`, `'npm'`) to keep keys consistent with `VulnerabilityEntry.ecosystem`
- Break the `$schema: 'osv-scan-result/v1'` identifier — this is a versioned contract
- Skip tests
- Commit without the task ID prefix

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution.
     Format:
     ### Amendment N — YYYY-MM-DD HH:MM
     **Issue:** [what was wrong]
     **Resolution:** [what was changed] -->
