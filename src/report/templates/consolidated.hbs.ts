export default `\
# Security Report — {{projectName}}
**Date:** {{date}}
**Environment:** {{environment}}

## Vulnerabilities Found
- **Total:** {{totalVulns}}
- **PHP (auto-safe/breaking/manual):** {{php.auto_safe}}/{{php.breaking}}/{{php.manual}}
- **npm (auto-safe/breaking/manual):** {{npm.auto_safe}}/{{npm.breaking}}/{{npm.manual}}

## Fixes Applied

### npm
{{#if npmUpdated}}
{{#each npmUpdated}}- {{this}}
{{/each}}
{{else}}
- No packages updated
{{/if}}

### Composer (PHP)
{{#if composerUpdated}}
{{#each composerUpdated}}- {{this}}
{{/each}}
{{else}}
- No packages updated
{{/if}}

## Validation After Updates
{{#if composerUpdate}}
- PHP test suite: {{composerTestStatus}}
{{#if composerUpdate.tests_detail}}
  {{composerUpdate.tests_detail}}
{{/if}}
{{/if}}
{{#if npmUpdate}}
- npm build: {{npmBuildStatus}}
{{#if npmUpdate.build_detail}}
  {{npmUpdate.build_detail}}
{{/if}}
{{/if}}

{{#if pendingItems}}
## Pending — Require Manual Action

{{#if breakingPkgs}}
### Require BREAKING CHANGE (awaiting per-package authorization)
{{#each breakingPkgs}}- {{this}}
  To authorize: "sim, confirmo breaking changes para [package]"
{{/each}}

{{/if}}
{{#if manualPkgs}}
### No safe version within current constraint
{{#each manualPkgs}}- {{this}}
{{/each}}

{{/if}}
{{/if}}
`;
