import type { PhaseStatus } from './common.js';

export interface UpdateResultJson {
  $schema: 'osv-update-result/v1';
  agent: string;
  status: PhaseStatus;
  packages_updated: string[];
  packages_skipped: string[];
  packages_pending_breaking: string[];
  tests: 'pass' | 'fail' | 'skipped';
  tests_detail: string;
  build_status?: 'pass' | 'fail' | 'skipped';
  build_detail?: string;
  error: string | null;
}
