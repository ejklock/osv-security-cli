export type SupportedLocale = 'pt-br' | 'en';

export interface ExecLocale {
  label_client: string;
  label_project: string;
  label_period: string;
  section_task: string;
  task_title: string;
  task_description: string;
  section_resolution: string;
  no_vulns: string;
  found_and_fixed: string;
  pending_intro: string;
  table_fixed_header: string;
  table_pending_header: string;
  section_evidence_before: string;
  table_before_header: string;
  scan_before_summary(total: number, phpLabel: string, npmLabel: string): string;
  section_evidence_after: string;
  composer_evidence_title: string;
  npm_evidence_title: string;
  table_after_header: string;
  scan_after_summary(total: number, phpLabel: string, npmLabel: string): string;
  tests_verified_intro: string;
  build_verified(detail: string): string;
  section_summary: string;
  all_fixed: string;
  pending_needs_action_intro: string;
  pending_manual: string;
  fixed_version(version: string): string;
}

export interface ConsolidatedLocale {
  title(projectName: string): string;
  label_date: string;
  label_environment: string;
  section_vulns: string;
  label_total: string;
  section_fixes: string;
  npm_header: string;
  composer_header: string;
  no_packages_updated: string;
  section_validation: string;
  php_tests_label: string;
  npm_build_label: string;
  section_pending: string;
  breaking_title: string;
  breaking_authorize: string;
  no_safe_version_title: string;
}

export interface ReasonLocale {
  no_safe_version: string;
  major_bump(targetVersion: string): string;
  major_bump_generic: string;
  protected_constraint(constraint: string): string;
}

export interface StatusLocale {
  no_fix: string;
  needs_auth: string;
  pending: string;
}

export interface Locale {
  months: readonly string[];
  authorization_format: string;
  pkg_count(vulnCount: number, pkgCount: number, ecosystem: string, names?: string): string;
  exec: ExecLocale;
  reason: ReasonLocale;
  status: StatusLocale;
  consolidated: ConsolidatedLocale;
}
