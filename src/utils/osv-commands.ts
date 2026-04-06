import type { EcosystemPlugin } from '../ecosystem/types.js';

export const OSV = {
  checkAvailable: 'osv-scanner --version',
} as const;

/**
 * Builds the osv-scanner scan command from an array of active plugins.
 * Each plugin contributes its own lockfile args via buildScanArgs().
 */
export function buildScanCommand(activePlugins: EcosystemPlugin[]): string {
  const args = activePlugins.flatMap((p) => p.buildScanArgs());
  return `osv-scanner ${args.join(' ')} --format json`;
}
