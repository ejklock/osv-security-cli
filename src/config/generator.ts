import Handlebars from 'handlebars';
import configTemplate from './templates/project-config.hbs.js';

export interface GenerateConfigOptions {
  projectName?: string;
  client?: string;
  execution?: 'docker' | 'local';
  dockerService?: string;
  dockerWorkdir?: string;
  phpVersion?: string;
  nodeVersion?: string;
  testCommand?: string;
  frontendBuildCommand?: string;
  backendBuildCommand?: string;
}

const compiled = Handlebars.compile(configTemplate, { noEscape: true });

export function generateConfigYaml(opts: GenerateConfigOptions = {}): string {
  return compiled({
    projectName: opts.projectName ?? 'My PHP Project',
    client: opts.client ?? 'Client Name',
    execution: opts.execution ?? 'docker',
    dockerService: opts.dockerService ?? 'app',
    dockerWorkdir: opts.dockerWorkdir,
    phpVersion: opts.phpVersion ?? '8.2',
    nodeVersion: opts.nodeVersion ?? '20.x',
    testCommand: opts.testCommand ?? 'php artisan test --compact',
    frontendBuild: opts.frontendBuildCommand ?? 'npm run development-frontend',
    backendBuild: opts.backendBuildCommand ?? 'npm run development-backend',
  });
}
