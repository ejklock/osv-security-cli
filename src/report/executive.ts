import type { ExecutiveReportOptions } from '../types/report.js';
import type { VulnerabilityEntry } from '../types/scan.js';
import type { Locale } from './i18n/index.js';
import { getLocale } from './i18n/index.js';
import { render } from './renderer.js';
import executiveTemplate from './templates/executive.hbs.js';

// ── helpers ─────────────────────────────────────────────────────────────────

function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long' });
}

function ghsaLink(id: string): string {
  return id ? `[${id}](https://osv.dev/${id})` : '—';
}

function ecoLabel(ecosystem: 'composer' | 'npm'): string {
  return ecosystem === 'composer' ? 'Composer' : 'npm';
}

function parsePackageName(ref: string): string {
  const at = ref.lastIndexOf('@');
  return at > 0 ? ref.slice(0, at) : ref;
}

function uniqueCount(vulns: VulnerabilityEntry[]): number {
  return new Set(vulns.map((v) => v.package)).size;
}

function motivoStr(vuln: VulnerabilityEntry, locale: Locale): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) {
    return locale.reason.no_safe_version;
  }
  if (r.includes('Major version bump')) {
    const match = r.match(/(\S+)\s*→\s*(\S+)/);
    return match
      ? locale.reason.major_bump(match[2]!)
      : locale.reason.major_bump_generic;
  }
  if (r.includes('Protected package')) {
    const constraintMatch = r.match(/constraint\s+(\S+)/);
    return locale.reason.protected_constraint(constraintMatch?.[1] ?? 'configured constraint');
  }
  return r;
}

function pendingStatus(vuln: VulnerabilityEntry, locale: Locale): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) return locale.status.no_fix;
  if (r.includes('Major version bump')) return locale.status.needs_auth;
  return locale.status.pending;
}

// ── context builder ──────────────────────────────────────────────────────────

export function generateExecutiveReport(opts: ExecutiveReportOptions): string {
  const locale = getLocale(opts.locale);
  const now = new Date();

  const composerUpdated = opts.composerUpdate?.packages_updated ?? [];
  const npmUpdated = opts.npmUpdate?.packages_updated ?? [];
  const composerUpdatedNames = new Set(composerUpdated.map(parsePackageName));
  const npmUpdatedNames = new Set(npmUpdated.map(parsePackageName));

  const allVulnsBefore = [
    ...opts.scanBefore.php.vulnerabilities,
    ...opts.scanBefore.npm.vulnerabilities,
  ];

  const fixedVulns = allVulnsBefore
    .filter((v) => {
      const names = v.ecosystem === 'composer' ? composerUpdatedNames : npmUpdatedNames;
      return v.classification === 'auto_safe' && names.has(v.package);
    })
    .map((v) => ({
      ecoLabel: ecoLabel(v.ecosystem),
      ghsaLink: ghsaLink(v.ghsaId),
      cvss: v.cvss,
      package: v.package,
      currentVersion: v.currentVersion,
      safeVersion: v.safeVersion ?? '—',
      risk: v.risk,
    }));

  const pendingOriginal = allVulnsBefore.filter((v) => {
    if (v.classification !== 'auto_safe') return true;
    const names = v.ecosystem === 'composer' ? composerUpdatedNames : npmUpdatedNames;
    return !names.has(v.package);
  });

  const pendingVulns = pendingOriginal.map((v) => ({
    ecoLabel: ecoLabel(v.ecosystem),
    ghsaLink: ghsaLink(v.ghsaId),
    cvss: v.cvss,
    package: v.package,
    currentVersion: v.currentVersion,
    motivoPt: motivoStr(v, locale),
  }));

  const totalBefore = opts.scanBefore.php.vulnerabilities_total + opts.scanBefore.npm.vulnerabilities_total;
  const phpPkgsBefore = uniqueCount(opts.scanBefore.php.vulnerabilities);
  const npmPkgsBefore = uniqueCount(opts.scanBefore.npm.vulnerabilities);

  const phpVulnsAfter = opts.scanBefore.php.vulnerabilities.map((v) => {
    const fixed = composerUpdatedNames.has(v.package) && v.classification === 'auto_safe';
    return {
      ghsaId: v.ghsaId,
      cvss: v.cvss,
      package: v.package,
      statusPt: fixed ? locale.exec.fixed_version(v.safeVersion ?? '—') : pendingStatus(v, locale),
      risk: v.risk,
    };
  });

  const npmVulnsAfter = opts.scanBefore.npm.vulnerabilities.map((v) => {
    const fixed = npmUpdatedNames.has(v.package) && v.classification === 'auto_safe';
    return {
      ghsaId: v.ghsaId,
      cvss: v.cvss,
      package: v.package,
      statusPt: fixed ? locale.exec.fixed_version(v.safeVersion ?? '—') : pendingStatus(v, locale),
      risk: v.risk,
    };
  });

  const phpPendingOrig = pendingOriginal.filter((v) => v.ecosystem === 'composer');
  const npmPendingOrig = pendingOriginal.filter((v) => v.ecosystem === 'npm');
  const phpPkgsAfter = uniqueCount(phpPendingOrig);
  const npmPkgsAfter = uniqueCount(npmPendingOrig);

  const phpBeforeLabel = locale.pkg_count(opts.scanBefore.php.vulnerabilities_total, phpPkgsBefore, 'PHP/Composer');
  const npmBeforeLabel = locale.pkg_count(opts.scanBefore.npm.vulnerabilities_total, npmPkgsBefore, 'npm');

  const phpAfterNames = phpPkgsAfter === 1
    ? [...new Set(phpPendingOrig.map((v) => v.package))].join(', ')
    : undefined;
  const phpAfterLabel = locale.pkg_count(phpPendingOrig.length, phpPkgsAfter, 'PHP/Composer', phpAfterNames);
  const npmAfterLabel = locale.pkg_count(npmPendingOrig.length, npmPkgsAfter, 'npm');

  // pendingByPkg for Resumo/Summary section
  const pendingByPkgMap = new Map<string, VulnerabilityEntry[]>();
  for (const v of pendingOriginal) {
    const key = `${v.ecosystem}:${v.package}`;
    const arr = pendingByPkgMap.get(key) ?? [];
    arr.push(v);
    pendingByPkgMap.set(key, arr);
  }
  const pendingByPkg = [...pendingByPkgMap.values()].map((vulns) => {
    const v = vulns[0]!;
    const maxCvss = vulns.reduce((max, x) => {
      const n = parseFloat(x.cvss);
      const m = parseFloat(max);
      return !isNaN(n) && n > (isNaN(m) ? 0 : m) ? x.cvss : max;
    }, '0');
    return {
      package: v.package,
      currentVersion: v.currentVersion,
      motivoPt: motivoStr(v, locale),
      riskLabel: 'Risk',
      risk: v.risk,
      cvssDisplay: maxCvss !== '0' ? ` CVSS ${maxCvss}` : '',
    };
  });

  const composerTests = opts.composerUpdate?.tests;
  const npmBuildStatus = opts.npmUpdate?.build_status;

  const context: Record<string, unknown> = {
    t: locale.exec,
    client: opts.client,
    project: opts.project,
    monthFull: locale.months[now.getMonth()],
    year: now.getFullYear(),
    noVulns: totalBefore === 0,
    fixedVulns,
    pendingVulns,
    allVulnsBefore: allVulnsBefore.map((v) => ({
      ecoLabel: ecoLabel(v.ecosystem),
      ghsaId: v.ghsaId,
      cvss: v.cvss,
      package: v.package,
      currentVersion: v.currentVersion,
      risk: v.risk,
    })),
    totalBefore,
    scanBeforeSummary: locale.exec.scan_before_summary(totalBefore, phpBeforeLabel, npmBeforeLabel),
    hasPhpVulns: phpVulnsAfter.length > 0,
    phpVulnsAfter,
    hasNpmVulns: npmVulnsAfter.length > 0,
    npmVulnsAfter,
    scanAfterSummary: locale.exec.scan_after_summary(pendingOriginal.length, phpAfterLabel, npmAfterLabel),
    showComposerTests: composerTests === 'pass' && !!opts.composerUpdate?.tests_detail,
    composerTestsDetail: opts.composerUpdate?.tests_detail ?? '',
    showNpmBuild: npmBuildStatus === 'pass' && !!opts.npmUpdate?.build_detail,
    buildVerified: opts.npmUpdate?.build_detail ? locale.exec.build_verified(opts.npmUpdate.build_detail) : '',
    allFixed: fixedVulns.length > 0 && pendingOriginal.length === 0,
    pendingByPkg,
  };

  return render(executiveTemplate, context);
}

export function executiveReportFilename(client: string, project: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `[${client} ${project}] Report OSV Scanner - ${year}-${month} - ${monthName(now)}.md`;
}
