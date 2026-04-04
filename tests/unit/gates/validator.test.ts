import { describe, it, expect } from 'vitest';
import { validateGateA, validateGateB, validateGateC } from '../../../src/gates/validator.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../../fixtures');

async function loadFixture(name: string): Promise<unknown> {
  const raw = await readFile(resolve(fixturesDir, name), 'utf-8');
  return JSON.parse(raw);
}

describe('validateGateA (OSV Scanner)', () => {
  it('passes for valid scan result', async () => {
    const data = await loadFixture('scan-result-success.json');
    const result = validateGateA(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for error scan result', async () => {
    const data = await loadFixture('scan-result-error.json');
    const result = validateGateA(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Scanner returned error');
  });

  it('fails for missing required fields', () => {
    const result = validateGateA({ $schema: 'osv-scan-result/v1', agent: 'osv-scanner' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails for wrong $schema', () => {
    const result = validateGateA({ $schema: 'wrong-schema', agent: 'osv-scanner' });
    expect(result.valid).toBe(false);
  });

  it('fails for wrong agent', () => {
    const result = validateGateA({
      $schema: 'osv-scan-result/v1',
      agent: 'wrong-agent',
      status: 'success',
      environment: 'docker',
      php: { vulnerabilities_total: 0, auto_safe: 0, breaking: 0, manual: 0, auto_safe_packages: [], breaking_packages: [], manual_packages: [] },
      npm: { vulnerabilities_total: 0, auto_safe: 0, breaking: 0, manual: 0, auto_safe_packages: [], breaking_packages: [], manual_packages: [] },
      error: null,
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateGateB (npm updater)', () => {
  it('passes for valid npm update result', async () => {
    const data = await loadFixture('update-result-npm.json');
    const result = validateGateB(data);
    expect(result.valid).toBe(true);
  });

  it('accepts any valid update result regardless of agent string', async () => {
    const data = await loadFixture('update-result-composer.json');
    const result = validateGateB(data);
    // Gate B validates structure and status; agent identity is now the updater's responsibility
    expect(result.valid).toBe(true);
  });

  it('fails for missing packages_updated', () => {
    const result = validateGateB({
      $schema: 'osv-update-result/v1',
      agent: 'npm-safe-update',
      status: 'success',
      error: null,
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateGateC (composer updater)', () => {
  it('passes for valid composer update result', async () => {
    const data = await loadFixture('update-result-composer.json');
    const result = validateGateC(data);
    expect(result.valid).toBe(true);
  });

  it('accepts any valid update result regardless of agent string', async () => {
    const data = await loadFixture('update-result-npm.json');
    const result = validateGateC(data);
    // Gate C validates structure and status; agent identity is now the updater's responsibility
    expect(result.valid).toBe(true);
  });

  it('fails when status is error', () => {
    const result = validateGateC({
      $schema: 'osv-update-result/v1',
      agent: 'composer-safe-update',
      status: 'error',
      packages_updated: [],
      packages_skipped: [],
      packages_pending_breaking: [],
      tests: 'skipped',
      tests_detail: '',
      error: 'Something went wrong',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Something went wrong');
  });
});
