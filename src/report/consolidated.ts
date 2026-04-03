import type { ConsolidatedReport } from '../types/report.js';
import { getLocale } from './i18n/index.js';
import { render } from './renderer.js';
import consolidatedTemplate from './templates/consolidated.hbs.js';

export function generateConsolidatedReport(data: ConsolidatedReport): string {
  const locale = getLocale(data.locale);
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

  const statusLabel = (s: string | undefined) =>
    s === 'pass' ? '✅ PASS' : s === 'fail' ? '❌ FAIL' : '— skipped';

  const context: Record<string, unknown> = {
    t: {
      ...locale.consolidated,
      title: locale.consolidated.title(data.projectName),
    },
    date: data.date,
    environment: data.environment,
    totalVulns,
    php: scan.php,
    npm: scan.npm,
    npmUpdated: data.npmUpdate?.packages_updated?.length ? data.npmUpdate.packages_updated : null,
    composerUpdated: data.composerUpdate?.packages_updated?.length ? data.composerUpdate.packages_updated : null,
    composerUpdate: data.composerUpdate,
    composerTestStatus: statusLabel(data.composerUpdate?.tests),
    npmUpdate: data.npmUpdate,
    npmBuildStatus: statusLabel(data.npmUpdate?.build_status),
    pendingItems: breakingPkgs.length > 0 || manualPkgs.length > 0,
    breakingPkgs: breakingPkgs.length ? breakingPkgs : null,
    manualPkgs: manualPkgs.length ? manualPkgs : null,
  };

  return render(consolidatedTemplate, context);
}
