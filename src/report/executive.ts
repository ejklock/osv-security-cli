import type { ExecutiveReportOptions } from '../types/report.js';

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

export function generateExecutiveReport(opts: ExecutiveReportOptions): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = zeroPad(now.getMonth() + 1);
  const monthFull = monthNamePt(now);

  const npmFixed = opts.npmUpdate?.packages_updated ?? [];
  const composerFixed = opts.composerUpdate?.packages_updated ?? [];
  const allFixed = [...composerFixed.map((p) => ({ type: 'Composer', pkg: p })), ...npmFixed.map((p) => ({ type: 'npm', pkg: p }))];

  const npmBreaking = opts.scanBefore.npm.breaking_packages;
  const phpBreaking = opts.scanBefore.php.breaking_packages;
  const allPending = [
    ...phpBreaking.map((p) => ({ type: 'Composer', pkg: p })),
    ...npmBreaking.map((p) => ({ type: 'npm', pkg: p })),
  ];

  const hasFixed = allFixed.length > 0;
  const hasPending = allPending.length > 0;
  const noneFound =
    opts.scanBefore.php.vulnerabilities_total === 0 &&
    opts.scanBefore.npm.vulnerabilities_total === 0;

  const lines: string[] = [];

  lines.push(`Cliente: ${opts.client}`);
  lines.push(`Projeto: ${opts.project}`);
  lines.push(`Período: ${monthFull} ${year}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Tarefa');
  lines.push('');
  lines.push('Manutenção de Segurança — OSV Scanner (rotina mensal)');
  lines.push('');
  lines.push(
    'Verificação mensal das dependências instaladas (PHP/Composer e npm) para identificar pacotes com vulnerabilidades conhecidas e aplicar correções disponíveis.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Resolução');
  lines.push('');

  if (noneFound) {
    lines.push(
      'Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.',
    );
  } else if (hasFixed) {
    lines.push(
      'Após a execução da varredura, os seguintes problemas foram encontrados e corrigidos:',
    );
    lines.push('');
    lines.push(
      '| Tipo | Pacote | Versão Corrigida | Risco |',
    );
    lines.push('|------|--------|-----------------|-------|');
    for (const { type, pkg } of allFixed) {
      lines.push(`| ${type} | ${pkg} | — | — |`);
    }
  }

  if (hasPending) {
    lines.push('');
    lines.push(
      'As seguintes vulnerabilidades não puderam ser corrigidas automaticamente e permanecem pendentes:',
    );
    lines.push('');
    lines.push('| Tipo | Pacote | Versão Atual | Motivo |');
    lines.push('|------|--------|-------------|--------|');
    for (const { type, pkg } of allPending) {
      lines.push(`| ${type} | ${pkg} | — | Requer mudança disruptiva |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Resumo');
  lines.push('');

  if (noneFound) {
    lines.push(
      'Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.',
    );
  } else if (hasFixed && !hasPending) {
    lines.push(
      'Todas as vulnerabilidades identificadas foram corrigidas. O projeto está atualizado e seguro em relação às suas dependências.',
    );
  } else if (hasFixed && hasPending) {
    lines.push(
      'Todas as vulnerabilidades que puderam ser corrigidas sem mudanças disruptivas foram aplicadas. Os itens listados acima requerem avaliação ou autorização de versão principal.',
    );
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
