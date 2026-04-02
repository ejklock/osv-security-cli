import { z } from 'zod';

const ProtectedPackageSchema = z.object({
  package: z.string(),
  constraint: z.string(),
  reason: z.string(),
});

const RuntimeConfigSchema = z.object({
  php: z.string(),
  laravel: z.string(),
  node: z.string(),
  package_manager_php: z.string(),
  package_manager_js: z.string(),
  execution: z.enum(['docker', 'local']),
  docker_service: z.string(),
  docker_workdir: z.string().optional(),
  test_command: z.string().optional(),
  build_commands: z.object({
    frontend: z.string(),
    backend: z.string(),
  }).optional(),
});

const SafeUpdatePolicySchema = z.object({
  allow_patch_and_minor_within_constraints: z.boolean(),
  require_authorization_for_constraint_change: z.boolean(),
  authorization_format: z.string(),
});

export const ProjectConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    client: z.string(),
  }),
  runtime: RuntimeConfigSchema,
  protected_packages: z.object({
    composer: z.array(ProtectedPackageSchema),
    npm: z.array(ProtectedPackageSchema),
  }),
  safe_update_policy: SafeUpdatePolicySchema,
  conflict_resolution: z.string(),
});

export type ProjectConfigInput = z.input<typeof ProjectConfigSchema>;
