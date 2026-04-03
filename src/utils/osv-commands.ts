export const OSV = {
  scanPhp: 'osv-scanner --lockfile composer.lock --format json',
  scanNpm: 'osv-scanner --lockfile package-lock.json --format json',
  fixNpm: 'osv-scanner fix --strategy=in-place -L package-lock.json',
  checkAvailable: 'osv-scanner --version',
} as const;

export function buildScanCommand(php: boolean, npm: boolean): string {
  const lockfiles: string[] = [];
  if (php) lockfiles.push('--lockfile composer.lock');
  if (npm) lockfiles.push('--lockfile package-lock.json');
  return `osv-scanner ${lockfiles.join(' ')} --format json`;
}
