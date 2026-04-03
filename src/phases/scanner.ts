import type { CommandRunner } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { ScanResultJson, EcosystemScanResult, VulnerabilityEntry } from '../types/scan.js';
import { PhaseError, EnvironmentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { buildScanCommand, OSV } from '../utils/osv-commands.js';
import { hasPhp, hasNpm } from '../types/config.js';
import { classifyPackage } from '../policy/safe-update.js';

function emptyEcosystem(): EcosystemScanResult {
  return {
    vulnerabilities_total: 0,
    auto_safe: 0,
    breaking: 0,
    manual: 0,
    auto_safe_packages: [],
    breaking_packages: [],
    manual_packages: [],
    vulnerabilities: [],
  };
}

// Minimal CVSS v3 base score calculator from vector string
// e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
function parseCvssBaseScore(score: string): string {
  try {
    const match = score.match(/CVSS:\d+\.\d+\/(.+)/);
    if (!match) return '—';
    const metrics: Record<string, string> = {};
    for (const part of match[1]!.split('/')) {
      const [k, v] = part.split(':');
      if (k && v) metrics[k] = v;
    }

    const av = ({ N: 0.85, A: 0.62, L: 0.55, P: 0.2 })[metrics['AV'] ?? ''] ?? 0;
    const ac = ({ L: 0.77, H: 0.44 })[metrics['AC'] ?? ''] ?? 0;
    const scope = metrics['S'] === 'C';
    const prMap = scope
      ? { N: 0.85, L: 0.68, H: 0.50 }
      : { N: 0.85, L: 0.62, H: 0.27 };
    const pr = prMap[metrics['PR'] as keyof typeof prMap] ?? 0;
    const ui = ({ N: 0.85, R: 0.62 })[metrics['UI'] ?? ''] ?? 0;
    const impMap = { N: 0, L: 0.22, H: 0.56 };
    const c = impMap[metrics['C'] as keyof typeof impMap] ?? 0;
    const i = impMap[metrics['I'] as keyof typeof impMap] ?? 0;
    const a = impMap[metrics['A'] as keyof typeof impMap] ?? 0;

    const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
    if (iscBase <= 0) return '0.0';

    let isc: number;
    if (!scope) {
      isc = 6.42 * iscBase;
    } else {
      isc = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
    }

    const exploitability = 8.22 * av * ac * pr * ui;

    let raw: number;
    if (!scope) {
      raw = Math.min(isc + exploitability, 10);
    } else {
      raw = Math.min(1.08 * (isc + exploitability), 10);
    }

    // Roundup: smallest value with one decimal place >= raw
    const rounded = Math.ceil(raw * 10) / 10;
    return rounded.toFixed(1);
  } catch {
    return '—';
  }
}

function extractCvss(vuln: {
  severity?: Array<{ type?: string; score?: string }>;
}): string {
  for (const s of vuln.severity ?? []) {
    if (s.type === 'CVSS_V3' && s.score) {
      return parseCvssBaseScore(s.score);
    }
  }
  return '—';
}

function extractSafeVersionFromVuln(vuln: {
  affected?: Array<{ ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
}): string | null {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) return event.fixed;
      }
    }
  }
  return null;
}

type OsvVulnerability = {
  id?: string;
  summary?: string;
  severity?: Array<{ type?: string; score?: string }>;
  affected?: Array<{ ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
};

type OsvJsonOutput = {
  results?: Array<{
    packages?: Array<{
      package?: { name?: string; version?: string; ecosystem?: string };
      vulnerabilities?: OsvVulnerability[];
    }>;
  }>;
};

function parseOsvJsonOutput(
  stdout: string,
  config: ProjectConfig,
): Pick<ScanResultJson, 'php' | 'npm'> {
  const data = JSON.parse(stdout) as OsvJsonOutput;
  const php = emptyEcosystem();
  const npm = emptyEcosystem();

  if (!data.results) return { php, npm };

  // Pre-build Maps for O(1) protected-package lookup per vulnerability
  const protectedComposer = new Map(
    config.protected_packages.composer.map((p) => [p.package, p]),
  );
  const protectedNpm = new Map(
    config.protected_packages.npm.map((p) => [p.package, p]),
  );

  // Sets for O(1) dedup of package-ref strings instead of O(n) .includes()
  const phpSets = {
    auto_safe: new Set<string>(),
    breaking: new Set<string>(),
    manual: new Set<string>(),
  };
  const npmSets = {
    auto_safe: new Set<string>(),
    breaking: new Set<string>(),
    manual: new Set<string>(),
  };

  for (const result of data.results) {
    for (const pkg of result.packages ?? []) {
      const pkgName = pkg.package?.name ?? '';
      const pkgVersion = pkg.package?.version ?? '';
      const ecosystem = pkg.package?.ecosystem?.toLowerCase() ?? '';
      const isPhp = ecosystem === 'packagist' || ecosystem === 'composer';
      const isNpm = ecosystem === 'npm';
      const target = isPhp ? php : isNpm ? npm : null;
      if (!target) continue;

      const targetSets = isPhp ? phpSets : npmSets;

      for (const vuln of pkg.vulnerabilities ?? []) {
        const ghsaId = vuln.id ?? '';
        const risk = vuln.summary ?? '';
        const cvss = extractCvss(vuln);
        const safeVersion = extractSafeVersionFromVuln(vuln);

        const classified = classifyPackage(
          { name: pkgName, currentVersion: pkgVersion, safeVersion },
          isPhp ? protectedComposer : protectedNpm,
        );

        const entry: VulnerabilityEntry = {
          ecosystem: isPhp ? 'composer' : 'npm',
          package: pkgName,
          currentVersion: pkgVersion,
          safeVersion,
          cvss,
          ghsaId,
          risk,
          classification: classified.classification,
          reason: classified.reason ?? '',
        };

        target.vulnerabilities.push(entry);
        target.vulnerabilities_total++;

        const packageRef = `${pkgName}@${pkgVersion}`;

        if (classified.classification === 'auto_safe') {
          target.auto_safe++;
          if (!targetSets.auto_safe.has(packageRef)) {
            targetSets.auto_safe.add(packageRef);
            target.auto_safe_packages.push(packageRef);
          }
        } else if (classified.classification === 'breaking') {
          target.breaking++;
          if (!targetSets.breaking.has(packageRef)) {
            targetSets.breaking.add(packageRef);
            target.breaking_packages.push(packageRef);
          }
        } else {
          target.manual++;
          if (!targetSets.manual.has(packageRef)) {
            targetSets.manual.add(packageRef);
            target.manual_packages.push(packageRef);
          }
        }
      }
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

async function executeScan(runner: CommandRunner, config: ProjectConfig, cwd: string) {
  const cmd = buildScanCommand(hasPhp(config), hasNpm(config));
  logger.debug(`Running: ${cmd}`);
  return runner.run(cmd, { cwd });
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
      logger.info(`[DRY-RUN] Would execute: ${buildScanCommand(hasPhp(config), hasNpm(config))}`);
      return base;
    }

    const scanResult = await executeScan(runner, config, cwd);

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
