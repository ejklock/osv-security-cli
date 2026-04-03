/** Shape of a locale JSON file. All dynamic strings use {{varName}} placeholders. */
export interface RawLocale {
  months: [string, string, string, string, string, string, string, string, string, string, string, string];
  pkg_count: {
    one: string;   // vars: vulnCount, ecosystem, pkgCount, namesSuffix
    other: string; // vars: vulnCount, ecosystem, pkgCount
  };
  reason: {
    no_safe_version: string;
    major_bump: string;         // vars: version
    major_bump_generic: string;
    protected_constraint: string; // vars: constraint
  };
  status: {
    no_fix: string;
    needs_auth: string;
    pending: string;
  };
  exec: {
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
    scan_before_summary: string;  // vars: total, phpLabel, npmLabel
    section_evidence_after: string;
    composer_evidence_title: string;
    npm_evidence_title: string;
    table_after_header: string;
    scan_after_summary: string;   // vars: total, phpLabel, npmLabel
    tests_verified_intro: string;
    build_verified: string;       // vars: detail
    section_summary: string;
    all_fixed: string;
    pending_needs_action_intro: string;
    pending_manual: string;
    fixed_version: string;        // vars: version
  };
  consolidated: {
    title: string;                // vars: projectName
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
  };
}
