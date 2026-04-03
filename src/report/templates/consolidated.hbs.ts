export default `\
{{t.title}}
**{{t.label_date}}:** {{date}}
**{{t.label_environment}}:** {{environment}}

## {{t.section_vulns}}
- **{{t.label_total}}:** {{totalVulns}}
- **PHP (auto-safe/breaking/manual):** {{php.auto_safe}}/{{php.breaking}}/{{php.manual}}
- **npm (auto-safe/breaking/manual):** {{npm.auto_safe}}/{{npm.breaking}}/{{npm.manual}}

## {{t.section_fixes}}

{{t.npm_header}}
{{#if npmUpdated}}
{{#each npmUpdated}}- {{this}}
{{/each}}
{{else}}
- {{t.no_packages_updated}}
{{/if}}

{{t.composer_header}}
{{#if composerUpdated}}
{{#each composerUpdated}}- {{this}}
{{/each}}
{{else}}
- {{t.no_packages_updated}}
{{/if}}

## {{t.section_validation}}
{{#if composerUpdate}}
- {{t.php_tests_label}}: {{composerTestStatus}}
{{#if composerUpdate.tests_detail}}
  {{composerUpdate.tests_detail}}
{{/if}}
{{/if}}
{{#if npmUpdate}}
- {{t.npm_build_label}}: {{npmBuildStatus}}
{{#if npmUpdate.build_detail}}
  {{npmUpdate.build_detail}}
{{/if}}
{{/if}}

{{#if pendingItems}}
## {{t.section_pending}}

{{#if breakingPkgs}}
### {{t.breaking_title}}
{{#each breakingPkgs}}- {{this}}
  {{../t.breaking_authorize}}
{{/each}}

{{/if}}
{{#if manualPkgs}}
### {{t.no_safe_version_title}}
{{#each manualPkgs}}- {{this}}
{{/each}}

{{/if}}
{{/if}}
`;
