import type { ScanResultJson } from './scan.js';
import type { UpdateResultJson } from './update.js';
import type { PhaseStatus } from './common.js';

export interface ConsolidatedReport {
  projectName: string;
  date: string;
  environment: string;
  scan: ScanResultJson;
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
  overallStatus: PhaseStatus;
}

export interface ExecutiveReportOptions {
  client: string;
  project: string;
  scanBefore: ScanResultJson;
  scanAfter: ScanResultJson;
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
}
