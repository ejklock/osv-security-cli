#!/usr/bin/env node
import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, DEFAULT_CONFIG_PATH } from "../src/config/loader.js";
import { generateConfigYaml } from "../src/config/generator.js";
import { detectEnvironment } from "../src/environment/detector.js";
import { runOrchestrator } from "../src/phases/orchestrator.js";
import { generateConsolidatedReport } from "../src/report/consolidated.js";
import {
  generateExecutiveReport,
  executiveReportFilename,
} from "../src/report/executive.js";
import { runScanner } from "../src/phases/scanner.js";
import { setLogLevel } from "../src/utils/logger.js";
import {
  ConfigLoadError,
  GateValidationError,
  PhaseError,
} from "../src/utils/errors.js";
import { prompt } from "../src/utils/prompt.js";
import { LocalStorageProvider } from "../src/storage/local.js";
import { createStorageProvider } from "../src/storage/factory.js";
import { runCloudSetup } from "../src/commands/cloud-setup.js";
import type { StorageProvider } from "../src/storage/provider.js";
import type { ConsolidatedReport } from "../src/types/report.js";

const program = new Command();

program
  .name("osv-security")
  .description("OSV vulnerability scanning and safe dependency update CLI")
  .version("0.1.5");

const commonOptions = (cmd: Command) =>
  cmd
    .option(
      "-c, --config <path>",
      "Path to project-config.yml",
      DEFAULT_CONFIG_PATH,
    )
    .option("--cwd <path>", "Working directory", process.cwd())
    .option("--dry-run", "Show commands without executing", false)
    .option("-v, --verbose", "Verbose output", false)
    .option(
      "-q, --quiet",
      "Suppress all output except errors and final report",
      false,
    )
    .option("--json", "Output results as JSON", false)
    .option("-o, --output <path>", "Write report to file");

// init command
program
  .command("init")
  .description("Generate a project-config.yml template in the current project")
  .option("--project-name <name>", "Project name")
  .option("--client <name>", "Client name")
  .option("--execution <mode>", "Execution mode: docker or local", "docker")
  .option("--docker-service <service>", "Docker Compose service name", "app")
  .option(
    "--docker-workdir <path>",
    "Working directory inside the container (e.g. /var/www/html)",
  )
  .option("--php-version <version>", "PHP version", "8.2")
  .option("--laravel-version <version>", "Laravel version", "10.x")
  .option("--node-version <version>", "Node.js version", "20.x")
  .option("--test-command <cmd>", "Test command", "php artisan test --compact")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option(
    "--output <path>",
    "Output path (default: .github/agents/project-config.yml)",
  )
  .option("--force", "Overwrite existing file", false)
  .action(async (opts) => {
    const { access, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");

    const outputPath = opts.output
      ? resolve(opts.cwd, opts.output)
      : resolve(opts.cwd, DEFAULT_CONFIG_PATH);

    // Check if file already exists
    if (!opts.force) {
      try {
        await access(outputPath);
        process.stderr.write(
          `File already exists: ${outputPath}\nUse --force to overwrite.\n`,
        );
        process.exit(3);
      } catch {
        // File doesn't exist — proceed
      }
    }

    const projectName =
      opts.projectName ?? (await prompt("Project name", "My Laravel Project"));
    const client = opts.client ?? (await prompt("Client name", "Client Name"));

    const yaml = generateConfigYaml({
      projectName,
      client,
      execution: opts.execution as "docker" | "local",
      dockerService: opts.dockerService,
      dockerWorkdir: opts.dockerWorkdir,
      phpVersion: opts.phpVersion,
      laravelVersion: opts.laravelVersion,
      nodeVersion: opts.nodeVersion,
      testCommand: opts.testCommand,
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, yaml, "utf-8");
    process.stdout.write(`Created: ${outputPath}\n`);
    process.stdout.write(`\nNext steps:\n`);
    process.stdout.write(`  1. Edit ${outputPath} to match your project\n`);
    process.stdout.write(
      `  2. Review protected_packages — add any packages that must not be auto-upgraded\n`,
    );
    process.stdout.write(
      `  3. Run: osv-security scan --cwd <your-project-dir>\n`,
    );
    process.stdout.write(
      `     (config will be loaded from project-config.yml at project root by default)\n`,
    );
  });

// scan command
commonOptions(
  program.command("scan").description("Run vulnerability scan only (Phase 1)"),
).action(async (opts) => {
  await runCommand("scan", opts);
});

// fix command
commonOptions(
  program
    .command("fix")
    .description("Run full workflow: scan + npm fix + composer fix + executive report")
    .option(
      "--phases <phases>",
      "Comma-separated phases: scan,npm,composer,report",
      "scan,npm,composer",
    )
    .option("--no-report", "Skip executive report generation", false),
).action(async (opts) => {
  await runCommand("fix", opts);
});

// executive-report command
commonOptions(
  program
    .command("executive-report")
    .description("Generate executive report (reads client/project from config by default)")
    .option("--client <name>", "Client name (default: from project-config.yml)")
    .option("--project <name>", "Project name (default: from project-config.yml)"),
).action(async (opts) => {
  await runCommand("executive-report", opts);
});

// cloud-setup command
program
  .command("cloud-setup")
  .description("Interactive Google Drive folder picker — saves folder_id to project-config.yml")
  .option("-c, --config <path>", "Path to project-config.yml", DEFAULT_CONFIG_PATH)
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (opts: { config: string; cwd: string }) => {
    await runCloudSetup({ configPath: opts.config, cwd: opts.cwd });
  });

async function saveReport(
  filename: string,
  content: string,
  reportsDir: string,
  cloudStorageConfig: import("../src/types/config.js").CloudStorageConfig | undefined,
  cwd: string,
): Promise<void> {
  const providers: StorageProvider[] = [new LocalStorageProvider(reportsDir)];
  if (cloudStorageConfig) {
    try {
      providers.push(await createStorageProvider(cloudStorageConfig, cwd));
    } catch (err) {
      process.stderr.write(
        `Cloud storage init failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  let localSaved = false;
  for (const provider of providers) {
    try {
      const result = await provider.upload(filename, content);
      process.stdout.write(`Report saved [${result.provider}]: ${result.url}\n`);
      if (result.provider === 'local') localSaved = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!localSaved) {
        // Local save failure is fatal
        throw new Error(`Failed to save report locally: ${msg}`);
      }
      // Cloud failure is non-fatal
      process.stderr.write(`Cloud upload failed: ${msg}\n`);
    }
  }
}

async function runCommand(
  command: string,
  opts: {
    config: string;
    cwd: string;
    dryRun: boolean;
    verbose: boolean;
    quiet: boolean;
    json: boolean;
    output?: string;
    phases?: string;
    client?: string;
    project?: string;
    noReport?: boolean;
  },
): Promise<void> {
  if (opts.verbose) setLogLevel("debug");
  if (opts.quiet) setLogLevel("error");

  let exitCode = 0;

  try {
    const config = await loadConfig(opts.config, opts.cwd);
    const runner = await detectEnvironment(
      config.runtime.execution,
      config.runtime.docker_service,
      opts.cwd,
      opts.dryRun,
      config.runtime.docker_workdir,
    );

    if (command === "scan") {
      const scanResult = await runScanner(runner, config, opts.cwd);
      const output = opts.json
        ? JSON.stringify(scanResult, null, 2)
        : formatScanSummary(scanResult);
      await writeOutput(output, opts.output);
      if (scanResult.status === "error") exitCode = 2;
      else if (scanResult.php.breaking > 0 || scanResult.npm.breaking > 0)
        exitCode = 1;
    } else if (command === "fix") {
      const phases = opts.phases
        ? (opts.phases.split(",") as ("scan" | "npm" | "composer" | "report")[])
        : undefined;

      const scanBefore = await runScanner(runner, config, opts.cwd);

      const result = await runOrchestrator(runner, config, {
        configPath: opts.config,
        cwd: opts.cwd,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
        phases,
      });

      if (result.scan) {
        const report: ConsolidatedReport = {
          projectName: config.project.name,
          date: new Date().toISOString().split("T")[0]!,
          environment: runner.environment,
          scan: result.scan,
          npmUpdate: result.npmUpdate,
          composerUpdate: result.composerUpdate,
          overallStatus: result.overallStatus,
        };

        const output = opts.json
          ? JSON.stringify(result, null, 2)
          : generateConsolidatedReport(report);
        await writeOutput(output, opts.output);
      }

      if (!opts.noReport) {
        const scanAfter = await runScanner(runner, config, opts.cwd);
        const execReport = generateExecutiveReport({
          client: config.project.client,
          project: config.project.name,
          scanBefore,
          scanAfter,
          npmUpdate: result.npmUpdate,
          composerUpdate: result.composerUpdate,
        });
        const filename = executiveReportFilename(config.project.client, config.project.name);
        const reportsDir = resolve(opts.cwd, config.reports_dir ?? ".osv-scanner/reports");
        await saveReport(filename, execReport, reportsDir, config.cloud_storage, opts.cwd);
      }

      if (result.overallStatus === "error") exitCode = 1;
    } else if (command === "executive-report") {
      const client = opts.client ?? config.project.client;
      const project = opts.project ?? config.project.name;

      const scanBefore = await runScanner(runner, config, opts.cwd);

      const orchestratorResult = await runOrchestrator(runner, config, {
        configPath: opts.config,
        cwd: opts.cwd,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
      });

      const scanAfter = await runScanner(runner, config, opts.cwd);

      const report = generateExecutiveReport({
        client,
        project,
        scanBefore,
        scanAfter,
        npmUpdate: orchestratorResult.npmUpdate,
        composerUpdate: orchestratorResult.composerUpdate,
      });

      const filename = executiveReportFilename(client, project);
      const reportsDir = resolve(opts.cwd, config.reports_dir ?? ".osv-scanner/reports");
      await saveReport(filename, report, reportsDir, config.cloud_storage, opts.cwd);
    }
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      process.stderr.write(`Configuration error: ${err.message}\n`);
      exitCode = 3;
    } else if (err instanceof GateValidationError) {
      process.stderr.write(`Gate ${err.gate} validation failed:\n`);
      for (const e of err.errors) process.stderr.write(`  - ${e}\n`);
      exitCode = 2;
    } else if (err instanceof PhaseError) {
      process.stderr.write(`Phase "${err.phase}" failed: ${err.message}\n`);
      exitCode = 2;
    } else {
      process.stderr.write(
        `Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      exitCode = 2;
    }
  }

  process.exit(exitCode);
}

function formatScanSummary(
  scan: Awaited<ReturnType<typeof runScanner>>,
): string {
  const lines: string[] = [
    `## OSV Scan Report — ${new Date().toISOString().split("T")[0]}`,
    `**Environment:** ${scan.environment}`,
    "",
    "### PHP (composer.lock)",
    `- Total: ${scan.php.vulnerabilities_total}`,
    `- Auto-safe: ${scan.php.auto_safe}`,
    `- Breaking: ${scan.php.breaking}`,
    `- Manual: ${scan.php.manual}`,
    "",
    "### npm (package-lock.json)",
    `- Total: ${scan.npm.vulnerabilities_total}`,
    `- Auto-safe: ${scan.npm.auto_safe}`,
    `- Breaking: ${scan.npm.breaking}`,
    `- Manual: ${scan.npm.manual}`,
  ];

  if (scan.error) {
    lines.push("", `**Warning:** ${scan.error}`);
  }

  return lines.join("\n");
}

async function writeOutput(
  content: string,
  outputPath?: string,
): Promise<void> {
  if (outputPath) {
    const { mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf-8");
  } else {
    process.stdout.write(content + "\n");
  }
}

program.parse();
