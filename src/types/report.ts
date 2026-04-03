import type { ScanResultJson } from './scan.js';
import type { UpdateResultJson } from './update.js';
import type { PhaseStatus } from './common.js';
import type { SupportedLocale } from '../report/i18n/index.js';

export interface ConsolidatedReport {
  projectName: string;
  date: string;
  environment: string;
  scan: ScanResultJson;
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
  overallStatus: PhaseStatus;
  locale?: SupportedLocale;
}

export interface ExecutiveReportOptions {
  client: string;
  project: string;
  scanBefore: ScanResultJson;
  scanAfter: ScanResultJson;
  npmUpdate: UpdateResultJson | null;
  composerUpdate: UpdateResultJson | null;
  locale?: SupportedLocale;
}
