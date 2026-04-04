import type { CommandRunner } from '../types/common.js';
import type { ProjectConfig } from '../types/config.js';
import type { EcosystemScanResult } from '../types/scan.js';
import type { UpdateResultJson } from '../types/update.js';

/**
 * Context passed to each EcosystemUpdater.run() call.
 * The orchestrator is responsible for extracting the right EcosystemScanResult
 * slice from the full ScanResultJson before calling run().
 */
export interface UpdateContext {
  runner: CommandRunner;
  config: ProjectConfig;
  scanResult: EcosystemScanResult;
  cwd: string;
  authorizeBreaking: boolean;
}

/**
 * Contract for a package-manager-specific updater.
 * Adding a new ecosystem means implementing this interface and registering it
 * in UPDATER_REGISTRY — nothing else changes.
 */
export interface EcosystemUpdater {
  /** Ecosystem identifier, e.g. 'npm' or 'composer'. */
  ecosystem: string;
  /** Lock-files (relative paths) owned by this ecosystem. */
  lockFiles: string[];
  /** Returns true if this ecosystem is configured in the project config. */
  isConfigured(config: ProjectConfig): boolean;
  /** Execute the update workflow for this ecosystem. */
  run(ctx: UpdateContext): Promise<UpdateResultJson>;
}
