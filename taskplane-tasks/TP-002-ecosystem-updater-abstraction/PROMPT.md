# Task: TP-002 - EcosystemUpdater Interface and Updater Refactor

**Created:** 2026-04-04
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Introduces a new registry/interface pattern across multiple files in `src/phases/`, requiring a plan review before implementation to validate the interface contract and orchestrator loop design.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-002-ecosystem-updater-abstraction/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Today `npm-updater.ts` and `composer-updater.ts` are two free functions with nearly identical structure but no shared contract. Adding a third package manager (e.g. pip, cargo) requires duplicating the orchestrator logic and hardcoding another `if` branch.

This task introduces the `EcosystemUpdater` interface in `src/phases/updater.ts`, refactors both existing updaters to implement it, and replaces the hardcoded orchestrator dispatch with a registry loop. The goal is a clean extension point: adding a future package manager means implementing one interface and registering it — nothing else changes.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

## Environment

- **Workspace:** `src/phases/`, `src/types/`
- **Services required:** None

## File Scope

- `src/phases/updater.ts` (new)
- `src/phases/npm-updater.ts`
- `src/phases/composer-updater.ts`
- `src/phases/orchestrator.ts`
- `src/types/update.ts`
- `src/types/config.ts`
- `src/gates/validator.ts`
- `tests/unit/gates/validator.test.ts`
- `tests/integration/orchestrator.test.ts`

## Steps

### Step 0: Preflight

- [ ] Read and understand the full contents of `src/phases/npm-updater.ts`, `src/phases/composer-updater.ts`, `src/phases/orchestrator.ts`, `src/types/update.ts`, `src/types/config.ts`, and `src/gates/validator.ts`
- [ ] Run full test suite to confirm baseline: `npm test`

### Step 1: Define EcosystemUpdater Interface

Create `src/phases/updater.ts` with:

- [ ] `UpdateContext` interface: `{ runner: CommandRunner, config: ProjectConfig, scanResult: EcosystemScanResult, cwd: string, authorizeBreaking: boolean }`
- [ ] `EcosystemUpdater` interface: `{ ecosystem: string, lockFiles: string[], isConfigured(config: ProjectConfig): boolean, run(ctx: UpdateContext): Promise<UpdateResultJson> }`
- [ ] Export both types

Note: `UpdateContext.scanResult` is already `EcosystemScanResult` (the per-ecosystem slice) — the orchestrator is responsible for extracting the right slice before calling `run()`. This keeps updaters decoupled from the full `ScanResultJson` structure.

**Artifacts:**
- `src/phases/updater.ts` (new)

### Step 2: Refactor NpmUpdater

Refactor `src/phases/npm-updater.ts`:

- [ ] Create `NpmUpdater` class (or object literal) that implements `EcosystemUpdater`
  - `ecosystem = 'npm'`
  - `lockFiles = ['package.json', 'package-lock.json']`
  - `isConfigured(config)` returns `!!config.runtime.node` (reuses `hasNpm` logic)
  - `run(ctx)` contains the existing `runNpmUpdater` logic, reading from `ctx.scanResult` instead of `scanResult.npm`
- [ ] Remove the old `runNpmUpdater` export (or keep as deprecated wrapper if needed for other callers — check usages first)
- [ ] Export a singleton: `export const npmUpdater: EcosystemUpdater = new NpmUpdater()` (or const object)
- [ ] Run targeted tests: `npm test -- --reporter=verbose tests/unit/`

**Artifacts:**
- `src/phases/npm-updater.ts` (modified)

### Step 3: Refactor ComposerUpdater

Refactor `src/phases/composer-updater.ts`:

- [ ] Create `ComposerUpdater` class (or object literal) that implements `EcosystemUpdater`
  - `ecosystem = 'composer'`
  - `lockFiles = ['composer.json', 'composer.lock']`
  - `isConfigured(config)` returns `!!config.runtime.php` (reuses `hasPhp` logic)
  - `run(ctx)` contains the existing `runComposerUpdater` logic, reading from `ctx.scanResult`
- [ ] Remove old `runComposerUpdater` export (or keep as deprecated wrapper if needed)
- [ ] Export a singleton: `export const composerUpdater: EcosystemUpdater`
- [ ] Run targeted tests: `npm test -- --reporter=verbose tests/unit/`

**Artifacts:**
- `src/phases/composer-updater.ts` (modified)

### Step 4: Refactor Orchestrator to Use Registry

Update `src/phases/orchestrator.ts`:

- [ ] Replace direct imports of `runNpmUpdater` / `runComposerUpdater` with `npmUpdater` / `composerUpdater` singletons
- [ ] Define a `UPDATER_REGISTRY: EcosystemUpdater[]` array containing both singletons (order matters: npm before composer, matching current phase order)
- [ ] Replace the hardcoded Phase 2 / Phase 3 `if` blocks with a `for` loop over `UPDATER_REGISTRY` that:
  - Skips updaters where `!updater.isConfigured(config)`
  - Skips updaters where scan result has no updates to apply
  - Calls `updater.run(ctx)` with the correct `EcosystemScanResult` slice from `scanResult`
  - Applies gate validation after each update (gates B and C still validate by ecosystem)
  - Stops the loop on build/test failure (same behavior as today)
- [ ] `OrchestratorResult` should become generic enough to hold results keyed by ecosystem string instead of `npmUpdate`/`composerUpdate` — use `updateResults: Record<string, UpdateResultJson>` (or keep named fields for now and add a `TODO` comment — decide based on what's simpler without breaking TP-003)
- [ ] Run targeted tests: `npm test -- --reporter=verbose tests/integration/`

**Artifacts:**
- `src/phases/orchestrator.ts` (modified)

### Step 5: Update Types and Gate Validators

- [ ] In `src/types/update.ts`, widen `agent` field from `'composer-safe-update' | 'npm-safe-update'` to `string` — each updater sets its own agent string
- [ ] In `src/gates/validator.ts`, update `UpdateResultSchema.agent` from `z.enum([...])` to `z.string()` — gate identity validation moves to the updater itself, not the schema
- [ ] Remove `validateGateB` / `validateGateC` agent-identity checks (the agent string check `result.data.agent !== 'npm-safe-update'`) OR keep them but make them accept the ecosystem string dynamically — decide based on what's cleaner
- [ ] Run targeted tests: `npm test -- --reporter=verbose tests/unit/gates/`

**Artifacts:**
- `src/types/update.ts` (modified)
- `src/gates/validator.ts` (modified)

### Step 6: Testing & Verification

- [ ] Run FULL test suite: `npm test`
- [ ] Run build: `npm run build`
- [ ] Fix all failures

### Step 7: Documentation & Delivery

- [ ] Update `taskplane-tasks/CONTEXT.md` — log discoveries
- [ ] Log any tech debt or follow-up items in STATUS.md Discoveries table

## Documentation Requirements

**Must Update:**
- `taskplane-tasks/CONTEXT.md` — increment Next Task ID, log architectural change

**Check If Affected:**
- `src/index.ts` — check if it re-exports anything from phases that changed signatures

## Completion Criteria

- [ ] `src/phases/updater.ts` exists with `EcosystemUpdater` interface and `UpdateContext`
- [ ] `NpmUpdater` and `ComposerUpdater` implement `EcosystemUpdater`
- [ ] Orchestrator uses a registry loop — no hardcoded `if (hasNpm)` / `if (hasPhp)` dispatch
- [ ] All tests passing
- [ ] Build passes

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(TP-002): complete Step N — description`
- **Bug fixes:** `fix(TP-002): description`
- **Tests:** `test(TP-002): description`
- **Hydration:** `hydrate: TP-002 expand Step N checkboxes`

## Do NOT

- Add support for new package managers (pip, cargo, etc.) — that's future work
- Change the update logic itself — only restructure the shape of how it's called
- Modify `ScanResultJson` shape — that is TP-003's scope
- Skip tests
- Commit without the task ID prefix

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution.
     Format:
     ### Amendment N — YYYY-MM-DD HH:MM
     **Issue:** [what was wrong]
     **Resolution:** [what was changed] -->
