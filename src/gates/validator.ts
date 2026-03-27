import { z } from 'zod';
import type { GateResult } from '../types/common.js';
import type { ScanResultJson } from '../types/scan.js';
import type { UpdateResultJson } from '../types/update.js';

const EcosystemScanResultSchema = z.object({
  vulnerabilities_total: z.number(),
  auto_safe: z.number(),
  breaking: z.number(),
  manual: z.number(),
  auto_safe_packages: z.array(z.string()),
  breaking_packages: z.array(z.string()),
  manual_packages: z.array(z.string()),
});

const ScanResultSchema = z.object({
  $schema: z.literal('osv-scan-result/v1'),
  agent: z.literal('osv-scanner'),
  status: z.enum(['success', 'error', 'skipped']),
  environment: z.enum(['docker', 'local']),
  php: EcosystemScanResultSchema,
  npm: EcosystemScanResultSchema,
  error: z.string().nullable(),
});

const UpdateResultSchema = z.object({
  $schema: z.literal('osv-update-result/v1'),
  agent: z.enum(['composer-safe-update', 'npm-safe-update']),
  status: z.enum(['success', 'error', 'skipped']),
  packages_updated: z.array(z.string()),
  packages_skipped: z.array(z.string()),
  packages_pending_breaking: z.array(z.string()),
  tests: z.enum(['pass', 'fail', 'skipped']),
  tests_detail: z.string(),
  build_status: z.enum(['pass', 'fail', 'skipped']).optional(),
  build_detail: z.string().optional(),
  error: z.string().nullable(),
});

export function validateGateA(data: unknown): GateResult {
  const result = ScanResultSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      gate: 'A',
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  if (result.data.status === 'error') {
    return {
      valid: false,
      gate: 'A',
      errors: [`Scanner returned error: ${result.data.error ?? 'unknown'}`],
    };
  }
  return { valid: true, gate: 'A', errors: [] };
}

export function validateGateB(data: unknown): GateResult {
  const result = UpdateResultSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      gate: 'B',
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  if (result.data.agent !== 'npm-safe-update') {
    return {
      valid: false,
      gate: 'B',
      errors: [`Expected agent "npm-safe-update", got "${result.data.agent}"`],
    };
  }
  if (result.data.status === 'error') {
    return {
      valid: false,
      gate: 'B',
      errors: [`npm updater returned error: ${result.data.error ?? 'unknown'}`],
    };
  }
  return { valid: true, gate: 'B', errors: [] };
}

export function validateGateC(data: unknown): GateResult {
  const result = UpdateResultSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      gate: 'C',
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  if (result.data.agent !== 'composer-safe-update') {
    return {
      valid: false,
      gate: 'C',
      errors: [`Expected agent "composer-safe-update", got "${result.data.agent}"`],
    };
  }
  if (result.data.status === 'error') {
    return {
      valid: false,
      gate: 'C',
      errors: [`Composer updater returned error: ${result.data.error ?? 'unknown'}`],
    };
  }
  return { valid: true, gate: 'C', errors: [] };
}

export function validateScanResult(data: ScanResultJson): GateResult {
  return validateGateA(data);
}

export function validateUpdateResult(
  data: UpdateResultJson,
  gate: 'B' | 'C',
): GateResult {
  return gate === 'B' ? validateGateB(data) : validateGateC(data);
}
