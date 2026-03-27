export type Ecosystem = 'php' | 'npm';
export type ExecutionEnv = 'docker' | 'local';
export type PhaseStatus = 'success' | 'error' | 'skipped';
export type VulnerabilityClass = 'auto_safe' | 'breaking' | 'manual';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  dryRun: boolean;
}

export interface CommandRunnerOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface CommandRunner {
  run(command: string, options?: CommandRunnerOptions): Promise<CommandResult>;
  readonly dryRun: boolean;
  readonly environment: ExecutionEnv;
}

export interface GateResult {
  valid: boolean;
  gate: 'A' | 'B' | 'C';
  errors: string[];
}
