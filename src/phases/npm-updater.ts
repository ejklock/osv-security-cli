import type { CommandRunner, CommandResult } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { UpdateResultJson } from '../types/update.js';
import type { ScanResultJson } from '../types/scan.js';
import { PhaseError } from '../utils/errors.js';
import { backupFiles, restoreFiles } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { OSV } from '../utils/osv-commands.js';

const NPM_FILES = ['package.json', 'package-lock.json'];

async function checkCurrentState(runner: CommandRunner, cwd: string): Promise<void> {
  logger.debug('Running npm outdated and npm audit (informational)...');
  await runner.run('npm outdated', { cwd });
  await runner.run('npm audit', { cwd });
}

async function applyOsvFix(runner: CommandRunner, cwd: string): Promise<void> {
  logger.info(`Applying OSV in-place fix: ${OSV.fixNpm}`);
  const result = await runner.run(OSV.fixNpm, { cwd, stream: true });
  if (result.exitCode !== 0) {
    logger.warn(`osv-scanner fix exited with ${result.exitCode}: ${result.stderr}`);
  }
}

async function runNpmUpdate(runner: CommandRunner, cwd: string): Promise<CommandResult> {
  logger.info('Running npm update...');
  return runner.run('npm update', { cwd, stream: true });
}

async function validateBuilds(
  runner: CommandRunner,
  config: ProjectConfig,
  cwd: string,
): Promise<{ frontend: CommandResult; backend: CommandResult }> {
  logger.info('Validating frontend build...');
  const frontend = await runner.run(config.runtime.build_commands!.frontend, { cwd, stream: true });
  logger.info('Validating backend build...');
  const backend = await runner.run(config.runtime.build_commands!.backend, { cwd, stream: true });
  return { frontend, backend };
}

async function revertNpmChanges(
  runner: CommandRunner,
  backups: Map<string, string>,
  cwd: string,
): Promise<void> {
  await restoreFiles(backups, cwd);
  await runner.run('npm install', { cwd });
}

async function verifyResidualVulnerabilities(runner: CommandRunner, cwd: string): Promise<void> {
  logger.info(`Running post-update OSV verification: ${OSV.scanNpm}`);
  await runner.run(OSV.scanNpm, { cwd });
}

export async function runNpmUpdater(
  runner: CommandRunner,
  config: ProjectConfig,
  scanResult: ScanResultJson,
  cwd: string,
): Promise<UpdateResultJson> {
  logger.info('Phase 2: Running npm safe updates...');

  const base: UpdateResultJson = {
    $schema: 'osv-update-result/v1',
    agent: 'npm-safe-update',
    status: 'success',
    packages_updated: [],
    packages_skipped: [],
    packages_pending_breaking: scanResult.npm.breaking_packages,
    tests: 'skipped',
    tests_detail: 'Build validated; unit tests not applicable to npm phase',
    build_status: 'skipped',
    build_detail: '',
    error: null,
  };

  if (runner.dryRun) {
    logger.info(`[DRY-RUN] Would execute: ${OSV.fixNpm}`);
    logger.info('[DRY-RUN] Would execute: npm update');
    if (config.runtime.build_commands) {
      logger.info(`[DRY-RUN] Would execute: ${config.runtime.build_commands.frontend}`);
      logger.info(`[DRY-RUN] Would execute: ${config.runtime.build_commands.backend}`);
    }
    logger.info(`[DRY-RUN] Would execute: ${OSV.scanNpm}`);
    return { ...base, build_status: config.runtime.build_commands ? 'pass' : 'skipped', build_detail: 'Dry-run — not executed' };
  }

  try {
    const backups = await backupFiles(NPM_FILES, cwd);

    await checkCurrentState(runner, cwd);
    await applyOsvFix(runner, cwd);

    const updateResult = await runNpmUpdate(runner, cwd);
    if (updateResult.exitCode !== 0) {
      return {
        ...base,
        status: 'error',
        build_status: 'fail',
        error: `npm update failed: ${updateResult.stderr}`,
      };
    }

    let buildStatus: UpdateResultJson['build_status'] = 'skipped';
    let buildDetail = 'No build_commands configured — skipped';

    if (config.runtime.build_commands) {
      const { frontend, backend } = await validateBuilds(runner, config, cwd);

      if (frontend.exitCode !== 0) {
        logger.error('Frontend build failed — reverting...');
        await revertNpmChanges(runner, backups, cwd);
        return {
          ...base,
          status: 'error',
          build_status: 'fail',
          build_detail: `Frontend build failed: ${frontend.stderr}`,
          error: 'Frontend build failed after npm update — changes reverted',
        };
      }

      if (backend.exitCode !== 0) {
        logger.error('Backend build failed — reverting...');
        await revertNpmChanges(runner, backups, cwd);
        return {
          ...base,
          status: 'error',
          build_status: 'fail',
          build_detail: `Backend build failed: ${backend.stderr}`,
          error: 'Backend build failed after npm update — changes reverted',
        };
      }

      buildStatus = 'pass';
      buildDetail = 'Frontend and backend builds passed after update';
    }

    await verifyResidualVulnerabilities(runner, cwd);

    return {
      ...base,
      packages_updated: scanResult.npm.auto_safe_packages,
      build_status: buildStatus,
      build_detail: buildDetail,
    };
  } catch (err) {
    throw new PhaseError(
      `npm updater phase failed: ${err instanceof Error ? err.message : String(err)}`,
      'npm-updater',
      err,
    );
  }
}
