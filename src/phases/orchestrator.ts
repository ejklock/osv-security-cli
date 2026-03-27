import type { CommandRunner, PhaseStatus } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { ScanResultJson } from '../types/scan.js';
import type { UpdateResultJson } from '../types/update.js';
import { validateGateA, validateGateB, validateGateC } from '../gates/validator.js';
import { GateValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { runScanner } from './scanner.js';
import { runNpmUpdater } from './npm-updater.js';
import { runComposerUpdater } from './composer-updater.js';

export interface OrchestratorOptions {
  configPath: string;
  cwd: string;
  dryRun: boolean;
  verbose: boolean;
  phases?: ('scan' | 'npm' | 'composer' | 'report')[];
  executiveReport?: {
    client: string;
    project: string;
  };
}

export interface OrchestratorResult {
  scan: ScanResultJson | null;
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
  overallStatus: PhaseStatus;
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

  // Check if any updates are needed
  const hasNpmUpdates = scanResult.npm.auto_safe > 0;
  const hasPhpUpdates = scanResult.php.auto_safe > 0;

  if (!hasNpmUpdates && !hasPhpUpdates) {
    logger.info('No auto-safe vulnerabilities found — no updates needed');
    return result;
  }

  // Phase 2 — npm remediation
  if (shouldRunPhase('npm', options) && hasNpmUpdates) {
    logger.info('=== Phase 2: npm Safe Updates ===');
    const npmResult = await runNpmUpdater(runner, config, scanResult, options.cwd);
    result.npmUpdate = npmResult;

    // Gate B validation
    const gateB = validateGateB(npmResult);
    if (!gateB.valid) {
      throw new GateValidationError(
        `Gate B validation failed: ${gateB.errors.join(', ')}`,
        'B',
        gateB.errors,
      );
    }

    if (npmResult.build_status === 'fail') {
      logger.error('npm build failed — stopping before Composer phase');
      result.overallStatus = 'error';
      return result;
    }

    logger.info(
      `npm update complete: ${npmResult.packages_updated.length} packages updated`,
    );
  } else if (!hasNpmUpdates) {
    logger.info('Phase 2: Skipping npm update — no auto-safe npm vulnerabilities');
  }

  // Phase 3 — Composer remediation
  if (shouldRunPhase('composer', options) && hasPhpUpdates) {
    logger.info('=== Phase 3: Composer Safe Updates ===');
    const composerResult = await runComposerUpdater(runner, config, scanResult, options.cwd);
    result.composerUpdate = composerResult;

    // Gate C validation
    const gateC = validateGateC(composerResult);
    if (!gateC.valid) {
      throw new GateValidationError(
        `Gate C validation failed: ${gateC.errors.join(', ')}`,
        'C',
        gateC.errors,
      );
    }

    if (composerResult.tests === 'fail') {
      logger.error('Composer tests failed — workflow stopped');
      result.overallStatus = 'error';
      return result;
    }

    logger.info(
      `Composer update complete: ${composerResult.packages_updated.length} packages updated`,
    );
  } else if (!hasPhpUpdates) {
    logger.info('Phase 3: Skipping Composer update — no auto-safe PHP vulnerabilities');
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
