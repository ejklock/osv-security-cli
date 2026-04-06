import type { ConsolidatedReport } from '../types/report.js';
import type { EcosystemScanResult } from '../types/scan.js';
import { defaultRegistry } from '../ecosystem/index.js';
import { getLocale } from './i18n/index.js';
import { render } from './renderer.js';
import consolidatedTemplate from './templates/consolidated.hbs.js';

function emptyEcosystemResult(): EcosystemScanResult {
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

function statusLabel(s: string | undefined): string {
  return s === 'pass' ? '✅ PASS' : s === 'fail' ? '❌ FAIL' : '— skipped';
}

export function generateConsolidatedReport(data: ConsolidatedReport): string {
  const locale = getLocale(data.locale);
  const scan = data.scan;
  const ecosystemEntries = Object.entries(scan.ecosystems);
  const totalVulns = ecosystemEntries.reduce((sum, [, e]) => sum + e.vulnerabilities_total, 0);

  const breakingPkgs = ecosystemEntries.flatMap(([id, e]) =>
    e.breaking_packages.map((p) => `[${id.toUpperCase()}] ${p}`),
  );
  const manualPkgs = ecosystemEntries.flatMap(([id, e]) =>
    e.manual_packages.map((p) => `[${id.toUpperCase()}] ${p}`),
  );

  // Build per-ecosystem sections driven by registry plugins
  const plugins = defaultRegistry.getAll();
  const ecosystemSections = plugins.map((plugin) => {
    const eco = scan.ecosystems[plugin.id] ?? emptyEcosystemResult();
    const update = data.updates[plugin.id] ?? null;

    // Resolve validation status and detail from the canonical validations[] array
    const validationEntry = update?.validations?.find((v) => v.name === plugin.validationName);
    const validationStatus = update ? statusLabel(validationEntry?.status) : null;
    const validationDetail = validationEntry?.detail ?? '';

    const updatedPackages = update?.packages_updated?.length ? update.packages_updated : null;

    return {
      id: plugin.id,
      name: plugin.name,
      reportLabel: plugin.reportLabel,
      validationLabel: plugin.validationLabel,
      ecosystemHeader: locale.consolidated.ecosystem_header(plugin.name),
      eco,
      update,
      validationStatus,
      validationDetail,
      updatedPackages,
    };
  });

  const context: Record<string, unknown> = {
    t: {
      ...locale.consolidated,
      title: locale.consolidated.title(data.projectName),
    },
    date: data.date,
    environment: data.environment,
    totalVulns,
    ecosystemSections,
    pendingItems: breakingPkgs.length > 0 || manualPkgs.length > 0,
    breakingPkgs: breakingPkgs.length ? breakingPkgs : null,
    manualPkgs: manualPkgs.length ? manualPkgs : null,
  };

  return render(consolidatedTemplate, context);
}
