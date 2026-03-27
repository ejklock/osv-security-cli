import { describe, it, expect } from 'vitest';
import { runOrchestrator } from '../../src/phases/orchestrator.js';
import { loadConfig } from '../../src/config/loader.js';
import { GateValidationError } from '../../src/utils/errors.js';
import type { CommandRunner, CommandResult, CommandRunnerOptions, ExecutionEnv } from '../../src/types/common.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures');

/**
 * MockCommandRunner: responds to commands with predetermined outputs.
 * Allows verifying what commands were called.
 */
class MockCommandRunner implements CommandRunner {
  readonly dryRun: boolean;
  readonly environment: ExecutionEnv;
  readonly calledCommands: string[] = [];
  private responses: Map<string, Partial<CommandResult>>;
  private defaultResponse: Partial<CommandResult>;

  constructor(
    responses: Record<string, Partial<CommandResult>> = {},
    options: { dryRun?: boolean; environment?: ExecutionEnv; defaultExitCode?: number } = {},
  ) {
    this.dryRun = options.dryRun ?? false;
    this.environment = options.environment ?? 'docker';
    this.responses = new Map(Object.entries(responses));
    this.defaultResponse = { stdout: '', stderr: '', exitCode: options.defaultExitCode ?? 0 };
  }

  async run(command: string, _options?: CommandRunnerOptions): Promise<CommandResult> {
    this.calledCommands.push(command);

    // Find matching response (by partial command match)
    for (const [key, response] of this.responses) {
      if (command.includes(key)) {
        return {
          stdout: response.stdout ?? '',
          stderr: response.stderr ?? '',
          exitCode: response.exitCode ?? 0,
          command,
          dryRun: this.dryRun,
        };
      }
    }

    return {
      stdout: this.defaultResponse.stdout ?? '',
      stderr: this.defaultResponse.stderr ?? '',
      exitCode: this.defaultResponse.exitCode ?? 0,
      command,
      dryRun: this.dryRun,
    };
  }
}

async function loadTestConfig() {
  return loadConfig('project-config.yml', fixturesDir);
}

describe('runOrchestrator — full pipeline', () => {
  it('skips npm and composer phases when no auto-safe vulnerabilities', async () => {
    const config = await loadTestConfig();
    const runner = new MockCommandRunner({
      '--version': { stdout: 'osv-scanner version 1.9.0', exitCode: 0 },
      '--lockfile composer.lock --lockfile package-lock.json --format json': {
        stdout: JSON.stringify({ results: [] }),
        exitCode: 0,
      },
    });

    const result = await runOrchestrator(runner, config, {
      configPath: 'project-config.yml',
      cwd: fixturesDir,
      dryRun: false,
      verbose: false,
    });

    expect(result.scan).not.toBeNull();
    expect(result.npmUpdate).toBeNull();
    expect(result.composerUpdate).toBeNull();
  });

  it('runs in dry-run mode without executing update commands', async () => {
    const config = await loadTestConfig();
    const runner = new MockCommandRunner(
      { '--version': { stdout: 'osv-scanner version 1.9.0', exitCode: 0 } },
      { dryRun: true },
    );

    const result = await runOrchestrator(runner, config, {
      configPath: 'project-config.yml',
      cwd: fixturesDir,
      dryRun: true,
      verbose: false,
    });

    expect(result.scan).not.toBeNull();
    // In dry-run, scan is executed but returns empty results
    // No update phases should have caused real side effects
    const updateCommands = runner.calledCommands.filter(
      (cmd) => cmd.includes('npm update') || cmd.includes('composer update'),
    );
    expect(updateCommands).toHaveLength(0);
  });

  it('only runs scan phase when phases=["scan"]', async () => {
    const config = await loadTestConfig();
    const runner = new MockCommandRunner({
      '--version': { stdout: 'osv-scanner version 1.9.0', exitCode: 0 },
      '--lockfile composer.lock --lockfile package-lock.json --format json': {
        stdout: JSON.stringify({ results: [] }),
        exitCode: 0,
      },
    });

    const result = await runOrchestrator(runner, config, {
      configPath: 'project-config.yml',
      cwd: fixturesDir,
      dryRun: false,
      verbose: false,
      phases: ['scan'],
    });

    expect(result.scan).not.toBeNull();
    expect(result.npmUpdate).toBeNull();
    expect(result.composerUpdate).toBeNull();
  });

  it('revert not called on successful npm update', async () => {
    const config = await loadTestConfig();
    const runner = new MockCommandRunner({
      '--version': { stdout: 'osv-scanner version 1.9.0', exitCode: 0 },
      '--lockfile composer.lock --lockfile package-lock.json --format json': {
        stdout: JSON.stringify({ results: [] }),
        exitCode: 0,
      },
      'git status': { stdout: '', exitCode: 0 },
      'npm update': { stdout: 'updated', exitCode: 0 },
      'development-frontend': { stdout: 'built', exitCode: 0 },
      'development-backend': { stdout: 'built', exitCode: 0 },
      '--lockfile package-lock.json --format json': { stdout: JSON.stringify({ results: [] }), exitCode: 0 },
    });

    await runOrchestrator(runner, config, {
      configPath: 'project-config.yml',
      cwd: fixturesDir,
      dryRun: false,
      verbose: false,
    });

    const revertCalls = runner.calledCommands.filter((cmd) => cmd.includes('git checkout'));
    expect(revertCalls).toHaveLength(0);
  });
});
