import Handlebars from 'handlebars';
import { getLocale } from '../report/i18n/index.js';
import type { SupportedLocale } from '../report/i18n/index.js';
import configTemplate from './templates/project-config.hbs.js';

export interface GenerateConfigOptions {
  projectName?: string;
  client?: string;
  execution?: 'docker' | 'local';
  dockerService?: string;
  dockerWorkdir?: string;
  ecosystems?: ('php' | 'npm')[];
  phpVersion?: string;
  nodeVersion?: string;
  testCommand?: string;
  frontendBuildCommand?: string;
  backendBuildCommand?: string;
  reportLanguage?: SupportedLocale;
}

const compiled = Handlebars.compile(configTemplate, { noEscape: true });

export function generateConfigYaml(opts: GenerateConfigOptions = {}): string {
  const locale = getLocale(opts.reportLanguage);
  const ecosystems = opts.ecosystems ?? ['php', 'npm'];
  const hasPhp = ecosystems.includes('php');
  const hasNpm = ecosystems.includes('npm');

  return compiled({
    projectName: opts.projectName ?? 'My PHP Project',
    client: opts.client ?? 'Client Name',
    execution: opts.execution ?? 'docker',
    dockerService: opts.dockerService ?? 'app',
    dockerWorkdir: opts.dockerWorkdir,
    hasPhp,
    hasNpm,
    phpVersion: opts.phpVersion ?? '8.2',
    nodeVersion: opts.nodeVersion ?? '20.x',
    testCommand: opts.testCommand ?? 'php artisan test --compact',
    frontendBuild: opts.frontendBuildCommand ?? 'npm run development-frontend',
    backendBuild: opts.backendBuildCommand ?? 'npm run development-backend',
    reportLanguage: opts.reportLanguage ?? 'pt-br',
    authorizationFormat: locale.authorization_format,
  });
}
