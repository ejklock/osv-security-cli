import type { CommandRunner, PhaseStatus } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { ScanResultJson, EcosystemScanResult } from '../types/scan.js';
import type { UpdateResultJson } from '../types/update.js';
import type { EcosystemUpdater } from './updater.js';
import { validateGateA, validateGateB, validateGateC } from '../gates/validator.js';
import { GateValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { runScanner } from './scanner.js';
import { npmUpdater } from './npm-updater.js';
import { composerUpdater } from './composer-updater.js';

export interface OrchestratorOptions {
  configPath: string;
  cwd: string;
  dryRun: boolean;
  verbose: boolean;
  phases?: ('scan' | 'npm' | 'composer' | 'report')[];
  authorizeBreakingPhp?: boolean;
  authorizeBreakingNpm?: boolean;
  executiveReport?: {
    client: string;
    project: string;
  };
}

export interface OrchestratorResult {
  scan: ScanResultJson | null;
  // TODO(TP-003): Replace named fields with `updateResults: Record<string, UpdateResultJson>`
  // once ScanResultJson is refactored to use `ecosystems: Record<string, EcosystemScanResult>`.
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
  overallStatus: PhaseStatus;
}

/**
 * Registry of all supported ecosystem updaters.
 * Order matters: npm runs before composer, matching the original phase order.
 * To add a new ecosystem, implement EcosystemUpdater and append it here.
 */
const UPDATER_REGISTRY: EcosystemUpdater[] = [npmUpdater, composerUpdater];

/**
 * Extracts the per-ecosystem scan result slice for the given ecosystem name.
 * NOTE: This helper will be removed when TP-003 migrates ScanResultJson to
 * use `ecosystems: Record<string, EcosystemScanResult>`.
 */
function getScanSlice(
  scanResult: ScanResultJson,
  ecosystem: string,
): EcosystemScanResult | null {
  if (ecosystem === 'npm') return scanResult.npm;
  if (ecosystem === 'composer') return scanResult.php;
  return null;
}

/**
 * Returns the authorizeBreaking flag for the given ecosystem.
 */
function getAuthorizeBreaking(ecosystem: string, options: OrchestratorOptions): boolean {
  if (ecosystem === 'npm') return options.authorizeBreakingNpm ?? false;
  if (ecosystem === 'composer') return options.authorizeBreakingPhp ?? false;
  return false;
}

/**
 * Returns the gate validation function for the given ecosystem.
 * Gate B → npm, Gate C → composer.
 */
function getGateValidator(
  ecosystem: string,
): ((data: unknown) => ReturnType<typeof validateGateB>) | null {
  if (ecosystem === 'npm') return validateGateB;
  if (ecosystem === 'composer') return validateGateC;
  return null;
}

/**
 * Returns the gate label for error messages.
 */
function getGateLabel(ecosystem: string): string {
  if (ecosystem === 'npm') return 'B';
  if (ecosystem === 'composer') return 'C';
  return ecosystem.toUpperCase();
}

/**
 * Checks whether the phase name (in options.phases) is enabled for this ecosystem.
 */
function isPhaseEnabled(ecosystem: string, options: OrchestratorOptions): boolean {
  if (!options.phases) return true;
  return options.phases.includes(ecosystem as 'npm' | 'composer');
}

function shouldRunPhase(
  phase: 'scan' | 'npm' | 'composer',
  options: OrchestratorOptions,
): boolean {
  if (!options.phases) return true;
  return options.phases.includes(phase);
}

export async function runOrchestrator(
  runner: CommandRunner,
  config: ProjectConfig,
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    scan: null,
    npmUpdate: null,
    composerUpdate: null,
    overallStatus: 'success',
  };

  // Phase 1 — Scan (hard precondition)
  if (!shouldRunPhase('scan', options)) {
    logger.warn('Skipping scan phase — phases option does not include "scan"');
    result.overallStatus = 'skipped';
    return result;
  }

  logger.info('=== Phase 1: Vulnerability Scan ===');
  const scanResult = await runScanner(runner, config, options.cwd);
  result.scan = scanResult;

  // Gate A validation
  const gateA = validateGateA(scanResult);
  if (!gateA.valid) {
    throw new GateValidationError(
      `Gate A validation failed: ${gateA.errors.join(', ')}`,
      'A',
      gateA.errors,
    );
  }

  logger.info(
    `Scan complete: ${scanResult.php.vulnerabilities_total} PHP vulns ` +
      `(${scanResult.php.auto_safe} auto-safe, ${scanResult.php.breaking} breaking), ` +
      `${scanResult.npm.vulnerabilities_total} npm vulns ` +
      `(${scanResult.npm.auto_safe} auto-safe, ${scanResult.npm.breaking} breaking)`,
  );

  // Check if any updates are needed across all registered updaters
  const anyUpdatesNeeded = UPDATER_REGISTRY.some((updater) => {
    if (!updater.isConfigured(config)) return false;
    const slice = getScanSlice(scanResult, updater.ecosystem);
    if (!slice) return false;
    const authorizeBreaking = getAuthorizeBreaking(updater.ecosystem, options);
    return slice.auto_safe > 0 || (authorizeBreaking && slice.breaking > 0);
  });

  if (!anyUpdatesNeeded) {
    logger.info('No auto-safe vulnerabilities found — no updates needed');
    return result;
  }

  // Registry loop — Phase 2+ (one iteration per registered updater)
  let phaseNumber = 2;
  for (const updater of UPDATER_REGISTRY) {
    const { ecosystem } = updater;

    if (!isPhaseEnabled(ecosystem, options)) {
      logger.info(`Phase ${phaseNumber}: Skipping ${ecosystem} update — not in phases list`);
      phaseNumber++;
      continue;
    }

    if (!updater.isConfigured(config)) {
      logger.info(`Phase ${phaseNumber}: Skipping ${ecosystem} update — ecosystem not configured`);
      phaseNumber++;
      continue;
    }

    const slice = getScanSlice(scanResult, ecosystem);
    if (!slice) {
      logger.info(`Phase ${phaseNumber}: Skipping ${ecosystem} update — no scan data`);
      phaseNumber++;
      continue;
    }

    const authorizeBreaking = getAuthorizeBreaking(ecosystem, options);
    const hasUpdates = slice.auto_safe > 0 || (authorizeBreaking && slice.breaking > 0);

    if (!hasUpdates) {
      logger.info(`Phase ${phaseNumber}: Skipping ${ecosystem} update — no auto-safe vulnerabilities`);
      phaseNumber++;
      continue;
    }

    logger.info(`=== Phase ${phaseNumber}: ${ecosystem.charAt(0).toUpperCase() + ecosystem.slice(1)} Safe Updates ===`);

    const updateResult = await updater.run({
      runner,
      config,
      scanResult: slice,
      cwd: options.cwd,
      authorizeBreaking,
    });

    // Store result in named field (TODO(TP-003): replace with updateResults Record)
    if (ecosystem === 'npm') result.npmUpdate = updateResult;
    if (ecosystem === 'composer') result.composerUpdate = updateResult;

    // Gate validation (B for npm, C for composer)
    const gateLabel = getGateLabel(ecosystem);
    const validate = getGateValidator(ecosystem);
    if (validate) {
      const gateResult = validate(updateResult);
      if (!gateResult.valid) {
        throw new GateValidationError(
          `Gate ${gateLabel} validation failed: ${gateResult.errors.join(', ')}`,
          gateLabel as 'B' | 'C',
          gateResult.errors,
        );
      }
    }

    // Stop on build failure (npm) or test failure (composer)
    if (updateResult.build_status === 'fail') {
      logger.error(`${ecosystem} build failed — stopping pipeline`);
      result.overallStatus = 'error';
      return result;
    }
    if (updateResult.tests === 'fail') {
      logger.error(`${ecosystem} tests failed — stopping pipeline`);
      result.overallStatus = 'error';
      return result;
    }

    logger.info(`${ecosystem} update complete: ${updateResult.packages_updated.length} packages updated`);
    phaseNumber++;
  }

  // Check if there are pending items
  const hasPendingItems =
    scanResult.php.breaking > 0 ||
    scanResult.npm.breaking > 0 ||
    scanResult.php.manual > 0 ||
    scanResult.npm.manual > 0;

  if (hasPendingItems) {
    result.overallStatus = 'error'; // exit code 1: vulns remain
  }

  return result;
}
