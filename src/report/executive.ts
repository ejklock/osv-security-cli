import type { ExecutiveReportOptions } from '../types/report.js';
import type { VulnerabilityEntry } from '../types/scan.js';
import { render } from './renderer.js';
import executiveTemplate from './templates/executive.hbs';

// ── helpers ─────────────────────────────────────────────────────────────────

function monthNamePt(date: Date): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[date.getMonth()]!;
}

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

function pkgCountLabel(count: number, vulnCount: number, ecosystem: string): string {
  return count === 1
    ? `${vulnCount} em ${ecosystem} (${count} pacote)`
    : `${vulnCount} em ${ecosystem} (${count} pacotes)`;
}

function motivoPt(vuln: VulnerabilityEntry): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) {
    return 'Sem correção disponível upstream';
  }
  if (r.includes('Major version bump')) {
    const match = r.match(/(\S+)\s*→\s*(\S+)/);
    return match
      ? `Requer versão major ${match[2]} — mudança disruptiva; requer autorização`
      : 'Requer versão major — mudança disruptiva; requer autorização';
  }
  if (r.includes('Protected package')) {
    const constraintMatch = r.match(/constraint\s+(\S+)/);
    const constraint = constraintMatch ? constraintMatch[1] : 'restrição configurada';
    return `Bloqueado por restrição ${constraint}`;
  }
  return r;
}

function pendingStatusPt(vuln: VulnerabilityEntry): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) return 'pendente (sem correção disponível)';
  if (r.includes('Major version bump')) return 'pendente (requer autorização)';
  return 'pendente';
}

// ── context builder ──────────────────────────────────────────────────────────

export function generateExecutiveReport(opts: ExecutiveReportOptions): string {
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

  const pendingVulns = allVulnsBefore
    .filter((v) => {
      if (v.classification !== 'auto_safe') return true;
      const names = v.ecosystem === 'composer' ? composerUpdatedNames : npmUpdatedNames;
      return !names.has(v.package);
    })
    .map((v) => ({
      ecoLabel: ecoLabel(v.ecosystem),
      ghsaLink: ghsaLink(v.ghsaId),
      cvss: v.cvss,
      package: v.package,
      currentVersion: v.currentVersion,
      motivoPt: motivoPt(v),
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
      statusPt: fixed ? `corrigido (${v.safeVersion ?? '—'})` : pendingStatusPt(v),
      risk: v.risk,
    };
  });

  const npmVulnsAfter = opts.scanBefore.npm.vulnerabilities.map((v) => {
    const fixed = npmUpdatedNames.has(v.package) && v.classification === 'auto_safe';
    return {
      ghsaId: v.ghsaId,
      cvss: v.cvss,
      package: v.package,
      statusPt: fixed ? `corrigido (${v.safeVersion ?? '—'})` : pendingStatusPt(v),
      risk: v.risk,
    };
  });

  const phpPendingVulns = pendingVulns.filter((_, i) => allVulnsBefore.filter((v) => {
    const names = v.ecosystem === 'composer' ? composerUpdatedNames : npmUpdatedNames;
    return v.classification !== 'auto_safe' || !names.has(v.package);
  })[i]?.ecosystem === 'composer');

  // simpler: re-filter original for ecosystem counts
  const pendingOriginal = allVulnsBefore.filter((v) => {
    if (v.classification !== 'auto_safe') return true;
    const names = v.ecosystem === 'composer' ? composerUpdatedNames : npmUpdatedNames;
    return !names.has(v.package);
  });
  const phpPendingOrig = pendingOriginal.filter((v) => v.ecosystem === 'composer');
  const npmPendingOrig = pendingOriginal.filter((v) => v.ecosystem === 'npm');
  const phpPkgsAfter = uniqueCount(phpPendingOrig);
  const npmPkgsAfter = uniqueCount(npmPendingOrig);

  // pendingByPkg for Resumo section
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
      motivoPt: motivoPt(v),
      risk: v.risk,
      cvssDisplay: maxCvss !== '0' ? ` CVSS ${maxCvss}` : '',
    };
  });

  const composerTests = opts.composerUpdate?.tests;
  const npmBuildStatus = opts.npmUpdate?.build_status;

  const phpAfterPkgList = phpPkgsAfter === 1
    ? `${phpPendingOrig.length} em PHP/Composer (${phpPkgsAfter} pacote: ${[...new Set(phpPendingOrig.map((v) => v.package))].join(', ')})`
    : `${phpPendingOrig.length} em PHP/Composer (${phpPkgsAfter} pacotes)`;

  const context: Record<string, unknown> = {
    client: opts.client,
    project: opts.project,
    monthFull: monthNamePt(now),
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
    phpLabel: pkgCountLabel(phpPkgsBefore, opts.scanBefore.php.vulnerabilities_total, 'PHP/Composer'),
    npmLabel: pkgCountLabel(npmPkgsBefore, opts.scanBefore.npm.vulnerabilities_total, 'npm'),
    hasPhpVulns: phpVulnsAfter.length > 0,
    phpVulnsAfter,
    hasNpmVulns: npmVulnsAfter.length > 0,
    npmVulnsAfter,
    totalAfter: pendingOriginal.length,
    phpAfterLabel: phpAfterPkgList,
    npmAfterLabel: npmPkgsAfter === 1
      ? `${npmPendingOrig.length} em npm (${npmPkgsAfter} pacote)`
      : `${npmPendingOrig.length} em npm (${npmPkgsAfter} pacotes)`,
    showComposerTests: composerTests === 'pass' && !!opts.composerUpdate?.tests_detail,
    composerTestsDetail: opts.composerUpdate?.tests_detail ?? '',
    showNpmBuild: npmBuildStatus === 'pass' && !!opts.npmUpdate?.build_detail,
    npmBuildDetail: opts.npmUpdate?.build_detail ?? '',
    allFixed: fixedVulns.length > 0 && pendingOriginal.length === 0,
    pendingByPkg,
  };

  // suppress unused variable — phpPendingVulns was an intermediate
  void phpPendingVulns;

  return render(executiveTemplate as unknown as string, context);
}

export function executiveReportFilename(client: string, project: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthEn = monthName(now);
  return `[${client} ${project}] Report OSV Scanner - ${year}-${month} - ${monthEn}.md`;
}
