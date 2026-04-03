import type { ConsolidatedReport } from '../types/report.js';
import { render } from './renderer.js';
import consolidatedTemplate from './templates/consolidated.hbs';

export function generateConsolidatedReport(data: ConsolidatedReport): string {
  const scan = data.scan;
  const totalVulns = scan.php.vulnerabilities_total + scan.npm.vulnerabilities_total;

  const breakingPkgs = [
    ...scan.php.breaking_packages.map((p) => `[PHP] ${p}`),
    ...scan.npm.breaking_packages.map((p) => `[npm] ${p}`),
  ];
  const manualPkgs = [
    ...scan.php.manual_packages.map((p) => `[PHP] ${p}`),
    ...scan.npm.manual_packages.map((p) => `[npm] ${p}`),
  ];

  const composerTestStatus = data.composerUpdate
    ? data.composerUpdate.tests === 'pass' ? '✅ PASS'
      : data.composerUpdate.tests === 'fail' ? '❌ FAIL'
      : '— skipped'
    : null;

  const npmBuildStatus = data.npmUpdate
    ? data.npmUpdate.build_status === 'pass' ? '✅ PASS'
      : data.npmUpdate.build_status === 'fail' ? '❌ FAIL'
      : '— skipped'
    : null;

  const context: Record<string, unknown> = {
    projectName: data.projectName,
    date: data.date,
    environment: data.environment,
    totalVulns,
    php: scan.php,
    npm: scan.npm,
    npmUpdated: data.npmUpdate?.packages_updated?.length ? data.npmUpdate.packages_updated : null,
    composerUpdated: data.composerUpdate?.packages_updated?.length ? data.composerUpdate.packages_updated : null,
    composerUpdate: data.composerUpdate,
    composerTestStatus,
    npmUpdate: data.npmUpdate,
    npmBuildStatus,
    pendingItems: breakingPkgs.length > 0 || manualPkgs.length > 0,
    breakingPkgs: breakingPkgs.length ? breakingPkgs : null,
    manualPkgs: manualPkgs.length ? manualPkgs : null,
  };

  return render(consolidatedTemplate as unknown as string, context);
}
