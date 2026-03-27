type ExecutionEnv = 'docker' | 'local';
type PhaseStatus = 'success' | 'error' | 'skipped';
interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
    dryRun: boolean;
}
interface CommandRunnerOptions {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
}
interface CommandRunner {
    run(command: string, options?: CommandRunnerOptions): Promise<CommandResult>;
    readonly dryRun: boolean;
    readonly environment: ExecutionEnv;
}
interface GateResult {
    valid: boolean;
    gate: 'A' | 'B' | 'C';
    errors: string[];
}

interface ProtectedPackage {
    package: string;
    constraint: string;
    reason: string;
}
interface RuntimeConfig {
    php: string;
    laravel: string;
    node: string;
    package_manager_php: string;
    package_manager_js: string;
    execution: ExecutionEnv;
    docker_service: string;
    test_command: string;
    build_commands: {
        frontend: string;
        backend: string;
    };
}
interface SafeUpdatePolicy {
    allow_patch_and_minor_within_constraints: boolean;
    require_authorization_for_constraint_change: boolean;
    authorization_format: string;
}
interface ProjectConfig {
    project: {
        name: string;
        client: string;
    };
    runtime: RuntimeConfig;
    protected_packages: {
        composer: ProtectedPackage[];
        npm: ProtectedPackage[];
    };
    safe_update_policy: SafeUpdatePolicy;
    conflict_resolution: string;
}

declare const DEFAULT_CONFIG_PATH = ".github/agents/project-config.yml";
declare function loadConfig(configPath: string, cwd?: string): Promise<ProjectConfig>;

interface GenerateConfigOptions {
    projectName?: string;
    client?: string;
    execution?: 'docker' | 'local';
    dockerService?: string;
    phpVersion?: string;
    laravelVersion?: string;
    nodeVersion?: string;
    testCommand?: string;
    frontendBuildCommand?: string;
    backendBuildCommand?: string;
}
declare function generateConfigYaml(opts?: GenerateConfigOptions): string;

interface EcosystemScanResult {
    vulnerabilities_total: number;
    auto_safe: number;
    breaking: number;
    manual: number;
    auto_safe_packages: string[];
    breaking_packages: string[];
    manual_packages: string[];
}
interface ScanResultJson {
    $schema: 'osv-scan-result/v1';
    agent: 'osv-scanner';
    status: PhaseStatus;
    environment: ExecutionEnv;
    php: EcosystemScanResult;
    npm: EcosystemScanResult;
    error: string | null;
}

interface UpdateResultJson {
    $schema: 'osv-update-result/v1';
    agent: 'composer-safe-update' | 'npm-safe-update';
    status: PhaseStatus;
    packages_updated: string[];
    packages_skipped: string[];
    packages_pending_breaking: string[];
    tests: 'pass' | 'fail' | 'skipped';
    tests_detail: string;
    build_status?: 'pass' | 'fail' | 'skipped';
    build_detail?: string;
    error: string | null;
}

interface OrchestratorOptions {
    configPath: string;
    cwd: string;
    dryRun: boolean;
    verbose: boolean;
    phases?: ('scan' | 'npm' | 'composer' | 'report')[];
    executiveReport?: {
        client: string;
        project: string;
    };
}
interface OrchestratorResult {
    scan: ScanResultJson | null;
    npmUpdate: UpdateResultJson | null;
    composerUpdate: UpdateResultJson | null;
    overallStatus: PhaseStatus;
}
declare function runOrchestrator(runner: CommandRunner, config: ProjectConfig, options: OrchestratorOptions): Promise<OrchestratorResult>;

interface ConsolidatedReport {
    projectName: string;
    date: string;
    environment: string;
    scan: ScanResultJson;
    npmUpdate: UpdateResultJson | null;
    composerUpdate: UpdateResultJson | null;
    overallStatus: PhaseStatus;
}
interface ExecutiveReportOptions {
    client: string;
    project: string;
    scanBefore: ScanResultJson;
    scanAfter: ScanResultJson;
    npmUpdate: UpdateResultJson | null;
    composerUpdate: UpdateResultJson | null;
}

declare function generateConsolidatedReport(data: ConsolidatedReport): string;

declare function generateExecutiveReport(opts: ExecutiveReportOptions): string;
declare function executiveReportFilename(client: string, project: string): string;

declare function validateGateA(data: unknown): GateResult;
declare function validateGateB(data: unknown): GateResult;
declare function validateGateC(data: unknown): GateResult;

declare class LocalExecutor implements CommandRunner {
    readonly dryRun: boolean;
    readonly environment: "local";
    constructor(options?: {
        dryRun?: boolean;
    });
    run(command: string, options?: CommandRunnerOptions): Promise<CommandResult>;
}

declare class DockerExecutor implements CommandRunner {
    private readonly service;
    readonly dryRun: boolean;
    readonly environment: "docker";
    constructor(service: string, options?: {
        dryRun?: boolean;
    });
    run(command: string, options?: CommandRunnerOptions): Promise<CommandResult>;
}

declare function detectEnvironment(preferredEnv: ExecutionEnv, dockerService: string, cwd: string, dryRun?: boolean): Promise<CommandRunner>;

export { type CommandRunner, DEFAULT_CONFIG_PATH, DockerExecutor, LocalExecutor, type OrchestratorOptions, type OrchestratorResult, type ProjectConfig, type ScanResultJson, type UpdateResultJson, detectEnvironment, executiveReportFilename, generateConfigYaml, generateConsolidatedReport, generateExecutiveReport, loadConfig, runOrchestrator, validateGateA, validateGateB, validateGateC };
