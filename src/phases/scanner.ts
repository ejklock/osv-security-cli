import type { CommandRunner } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { ScanResultJson, EcosystemScanResult } from '../types/scan.js';
import { PhaseError, EnvironmentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { OSV } from '../utils/osv-commands.js';

function emptyEcosystem(): EcosystemScanResult {
  return {
    vulnerabilities_total: 0,
    auto_safe: 0,
    breaking: 0,
    manual: 0,
    auto_safe_packages: [],
    breaking_packages: [],
    manual_packages: [],
  };
}

function extractSafeVersion(
  vulnerabilities: Array<{
    affected?: Array<{ ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
  }>,
): string | null {
  for (const vuln of vulnerabilities) {
    for (const affected of vuln.affected ?? []) {
      for (const range of affected.ranges ?? []) {
        for (const event of range.events ?? []) {
          if (event.fixed) return event.fixed;
        }
      }
    }
  }
  return null;
}

type OsvJsonOutput = {
  results?: Array<{
    packages?: Array<{
      package?: { name?: string; version?: string; ecosystem?: string };
      vulnerabilities?: Array<{
        affected?: Array<{ ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
      }>;
    }>;
  }>;
};

function classifyPackageIntoEcosystem(
  pkgName: string,
  pkgVersion: string,
  ecosystem: string,
  safeVersion: string | null,
  protectedComposer: Set<string>,
  protectedNpm: Set<string>,
  php: EcosystemScanResult,
  npm: EcosystemScanResult,
): void {
  const isPhp = ecosystem === 'packagist' || ecosystem === 'composer';
  const isNpm = ecosystem === 'npm';
  const target = isPhp ? php : isNpm ? npm : null;
  if (!target) return;

  const isProtected = (isPhp ? protectedComposer : protectedNpm).has(pkgName);
  const packageRef = `${pkgName}@${pkgVersion}`;

  target.vulnerabilities_total++;

  if (!safeVersion || isProtected) {
    target.breaking++;
    target.breaking_packages.push(packageRef);
  } else {
    target.auto_safe++;
    target.auto_safe_packages.push(packageRef);
  }
}

function parseOsvJsonOutput(
  stdout: string,
  config: ProjectConfig,
): Pick<ScanResultJson, 'php' | 'npm'> {
  const data = JSON.parse(stdout) as OsvJsonOutput;
  const php = emptyEcosystem();
  const npm = emptyEcosystem();

  if (!data.results) return { php, npm };

  const protectedComposer = new Set(config.protected_packages.composer.map((p) => p.package));
  const protectedNpm = new Set(config.protected_packages.npm.map((p) => p.package));

  for (const result of data.results) {
    for (const pkg of result.packages ?? []) {
      const pkgName = pkg.package?.name ?? '';
      const pkgVersion = pkg.package?.version ?? '';
      const ecosystem = pkg.package?.ecosystem?.toLowerCase() ?? '';
      const safeVersion = extractSafeVersion(pkg.vulnerabilities ?? []);

      classifyPackageIntoEcosystem(
        pkgName, pkgVersion, ecosystem, safeVersion,
        protectedComposer, protectedNpm, php, npm,
      );
    }
  }

  return { php, npm };
}

async function assertOsvScannerAvailable(runner: CommandRunner, cwd: string): Promise<void> {
  const result = await runner.run(OSV.checkAvailable, { cwd });
  if (result.exitCode !== 0) {
    throw new EnvironmentError(
      'osv-scanner not found. Install it with: brew install osv-scanner (macOS) or see https://github.com/google/osv-scanner',
    );
  }
}

async function executeScan(runner: CommandRunner, cwd: string) {
  logger.debug(`Running: ${OSV.scanAll}`);
  return runner.run(OSV.scanAll, { cwd });
}

export async function runScanner(
  runner: CommandRunner,
  config: ProjectConfig,
  cwd: string,
): Promise<ScanResultJson> {
  logger.info('Phase 1: Running OSV vulnerability scan...');

  const base: ScanResultJson = {
    $schema: 'osv-scan-result/v1',
    agent: 'osv-scanner',
    status: 'success',
    environment: runner.environment,
    php: emptyEcosystem(),
    npm: emptyEcosystem(),
    error: null,
  };

  try {
    await assertOsvScannerAvailable(runner, cwd);

    if (runner.dryRun) {
      logger.info(`[DRY-RUN] Would execute: ${OSV.scanAll}`);
      return base;
    }

    const scanResult = await executeScan(runner, cwd);

    if (scanResult.exitCode !== 0 && !scanResult.stdout) {
      return {
        ...base,
        status: 'error',
        error: `Scan failed (exit ${scanResult.exitCode}): ${scanResult.stderr}`,
      };
    }

    const parsed = parseOsvJsonOutput(scanResult.stdout, config);
    return { ...base, ...parsed };
  } catch (err) {
    if (err instanceof EnvironmentError) throw err;
    throw new PhaseError(
      `OSV scanner phase failed: ${err instanceof Error ? err.message : String(err)}`,
      'scanner',
      err,
    );
  }
}
