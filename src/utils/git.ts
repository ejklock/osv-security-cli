import type { CommandRunner } from '../types/common.js';

export async function revertFiles(
  runner: CommandRunner,
  files: string[],
  cwd: string,
): Promise<void> {
  if (files.length === 0) return;
  const fileList = files.join(' ');
  await runner.run(`git checkout -- ${fileList}`, { cwd });
}

export async function isWorkingTreeClean(
  runner: CommandRunner,
  files: string[],
  cwd: string,
): Promise<boolean> {
  const result = await runner.run(`git status --porcelain -- ${files.join(' ')}`, { cwd });
  return result.exitCode === 0 && result.stdout.trim() === '';
}
