import type { ScanResultJson } from './scan.js';
import type { UpdateResultJson } from './update.js';
import type { PhaseStatus } from './common.js';
import type { SupportedLocale } from '../report/i18n/index.js';

export interface ConsolidatedReport {
  projectName: string;
  date: string;
  environment: string;
  scan: ScanResultJson;
  /** Update results keyed by plugin id (e.g. 'npm', 'composer') */
  updates: Record<string, UpdateResultJson>;
  overallStatus: PhaseStatus;
  locale?: SupportedLocale;
}

export interface ExecutiveReportOptions {
  client: string;
  project: string;
  scanBefore: ScanResultJson;
  scanAfter: ScanResultJson;
  /** Update results keyed by plugin id (e.g. 'npm', 'composer') */
  updates: Record<string, UpdateResultJson>;
  locale?: SupportedLocale;
}
