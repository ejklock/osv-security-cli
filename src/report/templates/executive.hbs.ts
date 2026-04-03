export default `\
Cliente: {{client}}
Projeto: {{project}}
Período: {{monthFull}} {{year}}

Tarefa

Manutenção de Segurança — OSV Scanner (rotina mensal)

Verificação mensal das dependências instaladas (PHP/Composer e npm) para identificar pacotes com vulnerabilidades conhecidas e aplicar correções disponíveis.

Resolução

{{#if noVulns}}
Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.
{{else}}
{{#if fixedVulns}}
Após a execução da varredura, os seguintes problemas foram encontrados e corrigidos:

| Tipo | CVE/GHSA | CVSS | Pacote | Versão Antiga | Versão Corrigida | Risco |
|------|----------|------|---------|---------------|------------------|-------|
{{#each fixedVulns}}| {{ecoLabel}} | {{ghsaLink}} | {{cvss}} | {{package}} | {{currentVersion}} | {{safeVersion}} | {{risk}} |
{{/each}}{{/if}}
{{#if pendingVulns}}
As seguintes vulnerabilidades não puderam ser corrigidas automaticamente e permanecem pendentes:

| Tipo | CVE/GHSA | CVSS | Pacote | Versão Atual | Motivo |
|------|----------|------|---------|--------------|--------|
{{#each pendingVulns}}| {{ecoLabel}} | {{ghsaLink}} | {{cvss}} | {{package}} | {{currentVersion}} | {{motivoPt}} |
{{/each}}{{/if}}
{{/if}}

---

Evidencias — Antes

| Tipo | CVE/GHSA | CVSS | Pacote | Versão | Risco |
|------|----------|------|---------|--------|-------|
{{#each allVulnsBefore}}| {{ecoLabel}} | {{ghsaId}} | {{cvss}} | {{package}} | {{currentVersion}} | {{risk}} |
{{/each}}
Varredura inicial (antes das correções): **{{totalBefore}} vulnerabilidades** — {{phpLabel}}, {{npmLabel}}

---

Evidencias — Depois

{{#if hasPhpVulns}}
Composer (composer.lock) — resumo da varredura final:

| Tipo | CVE/GHSA | CVSS | Pacote | Status após correções | Risco |
|------|----------|------|---------|----------------------|-------|
{{#each phpVulnsAfter}}| Composer | {{ghsaId}} | {{cvss}} | {{package}} | {{statusPt}} | {{risk}} |
{{/each}}
{{/if}}
{{#if hasNpmVulns}}
npm (package-lock.json) — resumo da varredura final:

| Tipo | CVE/GHSA | CVSS | Pacote | Status após correções | Risco |
|------|----------|------|---------|----------------------|-------|
{{#each npmVulnsAfter}}| npm | {{ghsaId}} | {{cvss}} | {{package}} | {{statusPt}} | {{risk}} |
{{/each}}
{{/if}}
Varredura pós-correção: **{{totalAfter}} vulnerabilidades restantes** — {{phpAfterLabel}}, {{npmAfterLabel}}

{{#if showComposerTests}}
Verificação de testes após aplicação das correções:

\`\`\`
{{composerTestsDetail}}
\`\`\`

{{/if}}
{{#if showNpmBuild}}
Build de frontend verificado com sucesso: {{npmBuildDetail}}

{{/if}}

---

Resumo

{{#if noVulns}}
Nenhuma vulnerabilidade foi identificada nas dependências PHP ou npm. O projeto está atualizado e seguro.
{{else if allFixed}}
Todas as vulnerabilidades identificadas foram corrigidas. O projeto está atualizado e seguro em relação às suas dependências.
{{else if pendingByPkg}}
Todas as vulnerabilidades que puderam ser corrigidas sem mudanças disruptivas foram aplicadas. Os itens listados abaixo requerem avaliação ou autorização de versão principal:

{{#each pendingByPkg}}- {{package}} ({{currentVersion}}): {{motivoPt}}. Risco: {{risk}}{{cvssDisplay}}.
{{/each}}
{{else}}
Vulnerabilidades identificadas requerem ação manual — nenhuma correção automática foi aplicada.
{{/if}}
`;
