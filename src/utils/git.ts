import type { CommandRunner } from '../types/common.js';
import { LocalExecutor } from '../executor/local-executor.js';

// Git commands always run on the host, never inside Docker
function localRunner(dryRun: boolean): CommandRunner {
  return new LocalExecutor({ dryRun });
}

export async function revertFiles(
  runner: CommandRunner,
  files: string[],
  cwd: string,
): Promise<void> {
  if (files.length === 0) return;
  const fileList = files.join(' ');
  await localRunner(runner.dryRun).run(`git checkout -- ${fileList}`, { cwd });
}

export async function isWorkingTreeClean(
  runner: CommandRunner,
  files: string[],
  cwd: string,
): Promise<boolean> {
  const result = await localRunner(runner.dryRun).run(
    `git status --porcelain -- ${files.join(' ')}`,
    { cwd },
  );
  return result.exitCode === 0 && result.stdout.trim() === '';
}
