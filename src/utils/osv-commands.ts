export const OSV = {
  scanAll: 'osv-scanner --lockfile composer.lock --lockfile package-lock.json --format json',
  scanPhp: 'osv-scanner --lockfile composer.lock --format json',
  scanNpm: 'osv-scanner --lockfile package-lock.json --format json',
  fixNpm: 'osv-scanner fix --strategy=in-place -L package-lock.json',
  checkAvailable: 'osv-scanner --version',
} as const;
