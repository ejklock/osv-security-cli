import { describe, it, expect } from 'vitest';
import { generateConsolidatedReport } from '../../../src/report/consolidated.js';
import type { ConsolidatedReport } from '../../../src/types/report.js';

const mockReport: ConsolidatedReport = {
  projectName: 'Test Project',
  date: '2026-03-26',
  environment: 'docker',
  scan: {
    $schema: 'osv-scan-result/v1',
    agent: 'osv-scanner',
    status: 'success',
    environment: 'docker',
    php: {
      vulnerabilities_total: 2,
      auto_safe: 1,
      breaking: 1,
      manual: 0,
      auto_safe_packages: ['vendor/pkg@1.2.3'],
      breaking_packages: ['laravel/framework@10.0.0'],
      manual_packages: [],
    },
    npm: {
      vulnerabilities_total: 1,
      auto_safe: 1,
      breaking: 0,
      manual: 0,
      auto_safe_packages: ['lodash@4.17.20'],
      breaking_packages: [],
      manual_packages: [],
    },
    error: null,
  },
  npmUpdate: {
    $schema: 'osv-update-result/v1',
    agent: 'npm-safe-update',
    status: 'success',
    packages_updated: ['lodash@4.17.21'],
    packages_skipped: [],
    packages_pending_breaking: [],
    tests: 'skipped',
    tests_detail: 'Build validated',
    build_status: 'pass',
    build_detail: 'Frontend and backend builds passed',
    error: null,
  },
  composerUpdate: {
    $schema: 'osv-update-result/v1',
    agent: 'composer-safe-update',
    status: 'success',
    packages_updated: ['vendor/pkg@1.2.4'],
    packages_skipped: [],
    packages_pending_breaking: ['laravel/framework@10.0.0'],
    tests: 'pass',
    tests_detail: '42 tests passed, 0 failed',
    error: null,
  },
  overallStatus: 'success',
};

describe('generateConsolidatedReport', () => {
  it('includes project name', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('Test Project');
  });

  it('includes date', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('2026-03-26');
  });

  it('includes vulnerability totals', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('Total');
  });

  it('lists updated npm packages', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('lodash@4.17.21');
  });

  it('lists updated composer packages', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('vendor/pkg@1.2.4');
  });

  it('includes pending breaking changes', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('laravel/framework@10.0.0');
    expect(report).toContain('sim, confirmo breaking changes');
  });

  it('shows test pass status', () => {
    const report = generateConsolidatedReport(mockReport);
    expect(report).toContain('PASS');
  });
});
