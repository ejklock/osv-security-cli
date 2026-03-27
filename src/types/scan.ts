import type { ExecutionEnv, PhaseStatus, VulnerabilityClass } from './common.js';

export interface VulnerabilityEntry {
  ecosystem: 'composer' | 'npm';
  package: string;
  currentVersion: string;
  safeVersion: string | null;
  severity: string;
  cve: string;
  classification: VulnerabilityClass;
}

export interface EcosystemScanResult {
  vulnerabilities_total: number;
  auto_safe: number;
  breaking: number;
  manual: number;
  auto_safe_packages: string[];
  breaking_packages: string[];
  manual_packages: string[];
}

export interface ScanResultJson {
  $schema: 'osv-scan-result/v1';
  agent: 'osv-scanner';
  status: PhaseStatus;
  environment: ExecutionEnv;
  php: EcosystemScanResult;
  npm: EcosystemScanResult;
  error: string | null;
}
