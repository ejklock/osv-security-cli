import type { ExecutionEnv } from './common.js';

export interface ProtectedPackage {
  package: string;
  constraint: string;
  reason: string;
}

export interface RuntimeConfig {
  php: string;
  laravel: string;
  node: string;
  package_manager_php: string;
  package_manager_js: string;
  execution: ExecutionEnv;
  docker_service: string;
  docker_workdir?: string;
  test_command?: string;
  build_commands?: {
    frontend: string;
    backend: string;
  };
}

export interface SafeUpdatePolicy {
  allow_patch_and_minor_within_constraints: boolean;
  require_authorization_for_constraint_change: boolean;
  authorization_format: string;
}

export interface ProjectConfig {
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
