import type { ExecutiveReportOptions } from '../types/report.js';
import type { VulnerabilityEntry } from '../types/scan.js';

function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long' });
}

function monthNamePt(date: Date): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[date.getMonth()]!;
}

function zeroPad(n: number): string {
  return String(n).padStart(2, '0');
}

function ghsaLink(ghsaId: string): string {
  if (!ghsaId) return '—';
  return `[${ghsaId}](https://osv.dev/${ghsaId})`;
}

function ecoLabel(ecosystem: 'composer' | 'npm'): string {
  return ecosystem === 'composer' ? 'Composer' : 'npm';
}

function derivePendingStatusPt(vuln: VulnerabilityEntry): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) {
    return 'pendente (sem correção disponível)';
  }
  if (r.includes('Major version bump')) {
    return 'pendente (requer autorização)';
  }
  if (r.includes('Protected package')) {
    return 'pendente';
  }
  return 'pendente';
}

function deriveMotivoePt(vuln: VulnerabilityEntry): string {
  const r = vuln.reason;
  if (!r || r.includes('No safe version') || r.includes('Cannot parse')) {
    return 'Sem correção disponível upstream';
  }
  if (r.includes('Major version bump')) {
    const match = r.match(/(\S+)\s*→\s*(\S+)/);
    if (match) {
      return `Requer versão major ${match[2]} — mudança disruptiva; requer autorização`;
    }
    return 'Requer versão major — mudança disruptiva; requer autorização';
  }
  if (r.includes('Protected package')) {
    const constraintMatch = r.match(/constraint\s+(\S+)/);
    const constraint = constraintMatch ? constraintMatch[1] : 'restrição configurada';
    return `Bloqueado por restrição ${constraint}`;
  }
  return r;
}

function isPackageUpdated(
  vuln: VulnerabilityEntry,
  updatedPackages: string[],
): boolean {
  return updatedPackages.some((ref) => {
    const atIndex = ref.lastIndexOf('@');
    const name = atIndex > 0 ? ref.slice(0, atIndex) : ref;
    return name === vuln.package;
  });
}

function uniquePackageCount(vulns: VulnerabilityEntry[]): number {
  return new Set(vulns.map((v) => v.package)).size;
}

export function generateExecutiveReport(opts: ExecutiveReportOptions): string {
  const now = new Date();
  const year = now.getFullYear();
  const monthFull = monthNamePt(now);

  const allVulnsBefore = [
    ...opts.scanBefore.php.vulnerabilities,
    ...opts.scanBefore.npm.vulnerabilities,
  ];

  const composerUpdated = opts.composerUpdate?.packages_updated ?? [];
  const npmUpdated = opts.npmUpdate?.packages_updated ?? [];

  const fixedVulns = allVulnsBefore.filter((v) => {
    const updated = v.ecosystem === 'composer' ? composerUpdated : npmUpdated;
    return v.classification === 'auto_safe' && isPackageUpdated(v, updated);
  });

  const pendingVulns = allVulnsBefore.filter((v) => {
    if (v.classification !== 'auto_safe') return true;
    const updated = v.ecosystem === 'composer' ? composerUpdated : npmUpdated;
    return !isPackageUpdated(v, updated);
  });

  const totalBefore =
    opts.scanBefore.php.vulnerabilities_total + opts.scanBefore.npm.vulnerabilities_total;
  const phpPkgsBefore = uniquePackageCount(opts.scanBefore.php.vulnerabilities);
  const npmPkgsBefore = uniquePackageCount(opts.scanBefore.npm.vulnerabilities);

  const totalAfter = pendingVulns.length;
  const phpPendingVulns = pendingVulns.filter((v) => v.ecosystem === 'composer');
  const npmPendingVulns = pendingVulns.filter((v) => v.ecosystem === 'npm');
  const phpPkgsAfter = uniquePackageCount(phpPendingVulns);
  const npmPkgsAfter = uniquePackageCount(npmPendingVulns);

  const lines: string[] = [];

  // Header
  lines.push(`Cliente: ${opts.client}`);
  lines.push(`Projeto: ${opts.project}`);
  lines.push(`Período: ${monthFull} ${year}`);
  lines.push('');

  // Tarefa
  lines.push('Tarefa');
  lines.push('');
  lines.push('Manutenção de Segurança — OSV Scanner (rotina mensal)');
  lines.push('');
  lines.push(
    'Verificação mensal das dependências instaladas (PHP/Composer e npm) para identificar pacotes com vulnerabilidades conhecidas e aplicar correções disponíveis.',
  );
  lines.push('');

  // Resolução
  lines.push('Resolução');
  lines.push('');

  if (totalBefore === 0) {
    lines.push(
      'Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.',
    );
  } else if (fixedVulns.length > 0) {
    lines.push(
      'Após a execução da varredura, os seguintes problemas foram encontrados e corrigidos:',
    );
    lines.push('');
    lines.push('| Tipo | CVE/GHSA | CVSS | Pacote | Versão Antiga | Versão Corrigida | Risco |');
    lines.push('|------|----------|------|---------|---------------|------------------|-------|');
    for (const v of fixedVulns) {
      lines.push(
        `| ${ecoLabel(v.ecosystem)} | ${ghsaLink(v.ghsaId)} | ${v.cvss} | ${v.package} | ${v.currentVersion} | ${v.safeVersion ?? '—'} | ${v.risk} |`,
      );
    }
  }

  if (pendingVulns.length > 0) {
    lines.push('');
    lines.push(
      'As seguintes vulnerabilidades não puderam ser corrigidas automaticamente e permanecem pendentes:',
    );
    lines.push('');
    lines.push('| Tipo | CVE/GHSA | CVSS | Pacote | Versão Atual | Motivo |');
    lines.push('|------|----------|------|---------|--------------|--------|');
    for (const v of pendingVulns) {
      lines.push(
        `| ${ecoLabel(v.ecosystem)} | ${ghsaLink(v.ghsaId)} | ${v.cvss} | ${v.package} | ${v.currentVersion} | ${deriveMotivoePt(v)} |`,
      );
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Evidencias — Antes
  lines.push('Evidencias — Antes');
  lines.push('');
  lines.push('| Tipo | CVE/GHSA | CVSS | Pacote | Versão | Risco |');
  lines.push('|------|----------|------|---------|--------|-------|');
  for (const v of allVulnsBefore) {
    lines.push(
      `| ${ecoLabel(v.ecosystem)} | ${v.ghsaId} | ${v.cvss} | ${v.package} | ${v.currentVersion} | ${v.risk} |`,
    );
  }
  lines.push('');

  const phpLabel = phpPkgsBefore === 1
    ? `${opts.scanBefore.php.vulnerabilities_total} em PHP/Composer (${phpPkgsBefore} pacote)`
    : `${opts.scanBefore.php.vulnerabilities_total} em PHP/Composer (${phpPkgsBefore} pacotes)`;
  const npmLabel = npmPkgsBefore === 1
    ? `${opts.scanBefore.npm.vulnerabilities_total} em npm (${npmPkgsBefore} pacote)`
    : `${opts.scanBefore.npm.vulnerabilities_total} em npm (${npmPkgsBefore} pacotes)`;

  lines.push(
    `Varredura inicial (antes das correções): **${totalBefore} vulnerabilidades** — ${phpLabel}, ${npmLabel}`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Evidencias — Depois
  lines.push('Evidencias — Depois');
  lines.push('');

  if (opts.scanBefore.php.vulnerabilities.length > 0) {
    lines.push('Composer (composer.lock) — resumo da varredura final:');
    lines.push('');
    lines.push('| Tipo | CVE/GHSA | CVSS | Pacote | Status após correções | Risco |');
    lines.push('|------|----------|------|---------|----------------------|-------|');
    for (const v of opts.scanBefore.php.vulnerabilities) {
      const fixed = isPackageUpdated(v, composerUpdated) && v.classification === 'auto_safe';
      const status = fixed
        ? `corrigido (${v.safeVersion ?? '—'})`
        : derivePendingStatusPt(v);
      lines.push(
        `| Composer | ${v.ghsaId} | ${v.cvss} | ${v.package} | ${status} | ${v.risk} |`,
      );
    }
    lines.push('');
  }

  if (opts.scanBefore.npm.vulnerabilities.length > 0) {
    lines.push('npm (package-lock.json) — resumo da varredura final:');
    lines.push('');
    lines.push('| Tipo | CVE/GHSA | CVSS | Pacote | Status após correções | Risco |');
    lines.push('|------|----------|------|---------|----------------------|-------|');
    for (const v of opts.scanBefore.npm.vulnerabilities) {
      const fixed = isPackageUpdated(v, npmUpdated) && v.classification === 'auto_safe';
      const status = fixed
        ? `corrigido (${v.safeVersion ?? '—'})`
        : derivePendingStatusPt(v);
      lines.push(
        `| npm | ${v.ghsaId} | ${v.cvss} | ${v.package} | ${status} | ${v.risk} |`,
      );
    }
    lines.push('');
  }

  const phpAfterLabel = phpPkgsAfter === 1
    ? `${phpPendingVulns.length} em PHP/Composer (${phpPkgsAfter} pacote: ${[...new Set(phpPendingVulns.map((v) => v.package))].join(', ')})`
    : `${phpPendingVulns.length} em PHP/Composer (${phpPkgsAfter} pacotes)`;
  const npmAfterLabel = npmPkgsAfter === 1
    ? `${npmPendingVulns.length} em npm (${npmPkgsAfter} pacote)`
    : `${npmPendingVulns.length} em npm (${npmPkgsAfter} pacotes)`;

  lines.push(
    `Varredura pós-correção: **${totalAfter} vulnerabilidades restantes** — ${phpAfterLabel}, ${npmAfterLabel}`,
  );
  lines.push('');

  // Tests / Build verification
  const composerTests = opts.composerUpdate?.tests;
  const composerTestsDetail = opts.composerUpdate?.tests_detail;
  if (composerTests === 'pass' && composerTestsDetail) {
    lines.push('Verificação de testes após aplicação das correções:');
    lines.push('');
    lines.push('```');
    lines.push(composerTestsDetail);
    lines.push('```');
    lines.push('');
  }

  const npmBuildStatus = opts.npmUpdate?.build_status;
  const npmBuildDetail = opts.npmUpdate?.build_detail;
  if (npmBuildStatus === 'pass' && npmBuildDetail) {
    lines.push(`Build de frontend verificado com sucesso: ${npmBuildDetail}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Resumo
  lines.push('Resumo');
  lines.push('');

  if (totalBefore === 0) {
    lines.push(
      'Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.',
    );
  } else if (fixedVulns.length > 0 && pendingVulns.length === 0) {
    lines.push(
      'Todas as vulnerabilidades identificadas foram corrigidas. O projeto está atualizado e seguro em relação às suas dependências.',
    );
  } else if (pendingVulns.length > 0) {
    lines.push(
      'Todas as vulnerabilidades que puderam ser corrigidas sem mudanças disruptivas foram aplicadas. Os itens listados abaixo requerem avaliação ou autorização de versão principal:',
    );
    lines.push('');

    // Group pending by package for summary bullets
    const pendingByPkg = new Map<string, VulnerabilityEntry[]>();
    for (const v of pendingVulns) {
      const key = `${v.ecosystem}:${v.package}`;
      const existing = pendingByPkg.get(key) ?? [];
      existing.push(v);
      pendingByPkg.set(key, existing);
    }

    for (const [, vulns] of pendingByPkg) {
      const v = vulns[0]!;
      const maxCvss = vulns.reduce((max, x) => {
        const n = parseFloat(x.cvss);
        const m = parseFloat(max);
        return !isNaN(n) && n > (isNaN(m) ? 0 : m) ? x.cvss : max;
      }, '0');

      const cvssDisplay = maxCvss === '0' ? '' : ` CVSS ${maxCvss}`;
      lines.push(`- ${v.package} (${v.currentVersion}): ${deriveMotivoePt(v)}. Risco: ${v.risk}${cvssDisplay}.`);
    }
  } else {
    lines.push(
      'Vulnerabilidades identificadas requerem ação manual — nenhuma correção automática foi aplicada.',
    );
  }

  return lines.join('\n');
}

export function executiveReportFilename(client: string, project: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthEn = monthName(now);
  return `[${client} ${project}] Report OSV Scanner - ${year}-${month} - ${monthEn}.md`;
}
