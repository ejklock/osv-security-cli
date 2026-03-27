import type { ConsolidatedReport } from '../types/report.js';

export function generateConsolidatedReport(data: ConsolidatedReport): string {
  const lines: string[] = [];

  lines.push(`# Security Report — ${data.projectName}`);
  lines.push(`**Date:** ${data.date}`);
  lines.push(`**Environment:** ${data.environment}`);
  lines.push('');

  // Vulnerabilities found
  lines.push('## Vulnerabilities Found');
  const scan = data.scan;
  const totalVulns = scan.php.vulnerabilities_total + scan.npm.vulnerabilities_total;
  lines.push(`- **Total:** ${totalVulns}`);
  lines.push(
    `- **PHP (auto-safe/breaking/manual):** ${scan.php.auto_safe}/${scan.php.breaking}/${scan.php.manual}`,
  );
  lines.push(
    `- **npm (auto-safe/breaking/manual):** ${scan.npm.auto_safe}/${scan.npm.breaking}/${scan.npm.manual}`,
  );
  lines.push('');

  // Fixes applied
  lines.push('## Fixes Applied');

  if (data.npmUpdate && data.npmUpdate.packages_updated.length > 0) {
    lines.push('### npm');
    for (const pkg of data.npmUpdate.packages_updated) {
      lines.push(`- ${pkg}`);
    }
  } else {
    lines.push('### npm');
    lines.push('- No packages updated');
  }
  lines.push('');

  if (data.composerUpdate && data.composerUpdate.packages_updated.length > 0) {
    lines.push('### Composer (PHP)');
    for (const pkg of data.composerUpdate.packages_updated) {
      lines.push(`- ${pkg}`);
    }
  } else {
    lines.push('### Composer (PHP)');
    lines.push('- No packages updated');
  }
  lines.push('');

  // Validation results
  lines.push('## Validation After Updates');
  if (data.composerUpdate) {
    const testStatus = data.composerUpdate.tests === 'pass' ? '✅ PASS' : data.composerUpdate.tests === 'fail' ? '❌ FAIL' : '— skipped';
    lines.push(`- PHP test suite: ${testStatus}`);
    if (data.composerUpdate.tests_detail) {
      lines.push(`  ${data.composerUpdate.tests_detail}`);
    }
  }
  if (data.npmUpdate) {
    const buildStatus = data.npmUpdate.build_status === 'pass' ? '✅ PASS' : data.npmUpdate.build_status === 'fail' ? '❌ FAIL' : '— skipped';
    lines.push(`- npm build: ${buildStatus}`);
    if (data.npmUpdate.build_detail) {
      lines.push(`  ${data.npmUpdate.build_detail}`);
    }
  }
  lines.push('');

  // Pending items
  const pendingBreaking = [
    ...scan.php.breaking_packages.map((p) => `[PHP] ${p}`),
    ...scan.npm.breaking_packages.map((p) => `[npm] ${p}`),
  ];
  const pendingManual = [
    ...scan.php.manual_packages.map((p) => `[PHP] ${p}`),
    ...scan.npm.manual_packages.map((p) => `[npm] ${p}`),
  ];

  if (pendingBreaking.length > 0 || pendingManual.length > 0) {
    lines.push('## Pending — Require Manual Action');

    if (pendingBreaking.length > 0) {
      lines.push('### Require BREAKING CHANGE (awaiting per-package authorization)');
      for (const pkg of pendingBreaking) {
        lines.push(`- ${pkg}`);
        lines.push(
          `  To authorize: "sim, confirmo breaking changes para [package]"`,
        );
      }
      lines.push('');
    }

    if (pendingManual.length > 0) {
      lines.push('### No safe version within current constraint');
      for (const pkg of pendingManual) {
        lines.push(`- ${pkg}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
