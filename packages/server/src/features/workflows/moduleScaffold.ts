import fs from "node:fs";
import path from "node:path";
import type {
  ResourceOrToolResponse,
  ServerConfig,
  ServerState,
  WriteApplyResponse,
  WritePreviewResponse,
  WriteVerifyResponse,
  WriteChange,
} from "../../types.js";
import { getProjectManifest } from "../projectManifest.js";
import { isPathInsideDirectory, resolveProjectRoot, toProjectRelativePath } from "../projectPaths.js";
import { runScaffoldPlanning, type ScaffoldPlanData } from "./scaffoldPlanning.js";
import {
  consumePreviewToken,
  generatePreviewToken,
  getPreviewTokenStatus,
} from "../writeLifecycle.js";

export interface ModuleScaffoldInput {
  machine_name: string;
  target_type: "module";
}

export interface ModuleScaffoldFilePreview {
  path: string;
  target_path: string;
  content_preview: string;
}

export interface ModuleScaffoldPreviewData {
  machine_name: string;
  target_type: "module";
  target_directory: string;
  target_directory_exists: boolean;
  files: ModuleScaffoldFilePreview[];
  warnings: string[];
}

export interface ModuleScaffoldResultData {
  machine_name: string;
  target_type: "module";
  target_directory: string;
  created_files: string[];
}

export interface ModuleScaffoldVerificationFile {
  path: string;
  exists: boolean;
  non_empty: boolean;
  valid: boolean;
}

export interface ModuleScaffoldVerificationData {
  target_directory: string;
  directory_exists: boolean;
  files: ModuleScaffoldVerificationFile[];
}

export interface ModuleScaffoldApplyInput extends ModuleScaffoldInput {
  preview_token?: string;
}

interface ModuleScaffoldDependencies {
  getManifest?: typeof getProjectManifest;
}

function ensureConfig<T>(
  state: ServerState,
): { config: ServerConfig } | ResourceOrToolResponse<T> {
  if (!state.config) {
    return {
      status: "not_configured",
      error:
        state.configError ??
        {
          code: "E_CONFIG_INVALID_ROOT",
          message: "DriftCore configuration is missing or invalid",
        },
    };
  }

  return { config: state.config };
}

function validateInput(
  input: unknown,
): { ok: true; value: ModuleScaffoldInput } | { ok: false; response: ResourceOrToolResponse<never> } {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      response: {
        status: "error",
        error: {
          code: "E_INVALID_INPUT",
          message: "Module scaffold requires machine_name and target_type inputs.",
        },
      },
    };
  }

  const record = input as Record<string, unknown>;
  const machineName = typeof record.machine_name === "string" ? record.machine_name : "";
  const targetType = typeof record.target_type === "string" ? record.target_type : "";

  if (!/^[a-z][a-z0-9_]*$/.test(machineName)) {
    return {
      ok: false,
      response: {
        status: "error",
        error: {
          code: "E_INVALID_INPUT",
          message: "machine_name must match ^[a-z][a-z0-9_]*$",
        },
      },
    };
  }

  if (targetType !== "module") {
    return {
      ok: false,
      response: {
        status: "error",
        error: {
          code: "E_INVALID_INPUT",
          message: 'target_type must be "module".',
        },
      },
    };
  }

  return {
    ok: true,
    value: {
      machine_name: machineName,
      target_type: "module",
    },
  };
}

function machineNameToPascal(machineName: string): string {
  return machineName
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function machineNameToLabel(machineName: string): string {
  return machineName
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function machineNameToRouteSegment(machineName: string): string {
  return machineName.replace(/_/g, "-");
}

function lineLimitPreview(content: string, maxLines = 50): string {
  return content.split(/\r?\n/).slice(0, maxLines).join("\n");
}

function buildModuleFiles(
  config: ServerConfig,
  machineName: string,
  coreVersion: string | null,
): Array<{ path: string; content: string }> {
  const classBase = machineNameToPascal(machineName);
  const label = machineNameToLabel(machineName);
  const routeSegment = machineNameToRouteSegment(machineName);
  const coreRequirement = coreVersion ? `^${coreVersion.split(".")[0]}` : "^10 || ^11";

  return [
    {
      path: `${machineName}.info.yml`,
      content: [
        `name: ${label}`,
        "type: module",
        `description: Provides the ${label} module.`,
        "package: Custom",
        `core_version_requirement: ${coreRequirement}`,
      ].join("\n") + "\n",
    },
    {
      path: `${machineName}.module`,
      content: [
        "<?php",
        "",
        "/**",
        ` * @file`,
        ` * Hooks for the ${label} module.`,
        " */",
        "",
      ].join("\n"),
    },
    {
      path: `${machineName}.routing.yml`,
      content: [
        `${machineName}.example:`,
        `  path: '/${routeSegment}'`,
        "  defaults:",
        `    _controller: '\\Drupal\\${machineName}\\Controller\\${classBase}Controller::build'`,
        `    _title: '${label}'`,
        "  requirements:",
        "    _permission: 'access content'",
        "",
      ].join("\n"),
    },
    {
      path: `src/Controller/${classBase}Controller.php`,
      content: [
        "<?php",
        "",
        `namespace Drupal\\${machineName}\\Controller;`,
        "",
        "use Drupal\Core\Controller\ControllerBase;",
        "",
        `final class ${classBase}Controller extends ControllerBase {`,
        "  public function build(): array {",
        "    return [",
        `      '#markup' => $this->t('Hello from the ${label} module.'),`,
        "    ];",
        "  }",
        "}",
        "",
      ].join("\n"),
    },
  ];
}

function resolveModuleTargetDirectory(
  config: ServerConfig,
  machineName: string,
): { projectRoot: string; targetDirectory: string; targetDirectoryAbsolute: string } | null {
  const projectRoot = resolveProjectRoot(config);
  const moduleDirs = config.customModuleDirs ?? [];
  for (const moduleDir of moduleDirs) {
    const resolvedBase = path.resolve(projectRoot, moduleDir);
    const targetDirectoryAbsolute = path.resolve(resolvedBase, machineName);
    if (!isPathInsideDirectory(resolvedBase, targetDirectoryAbsolute)) {
      continue;
    }
    if (!isPathInsideDirectory(projectRoot, targetDirectoryAbsolute)) {
      continue;
    }
    return {
      projectRoot,
      targetDirectory: toProjectRelativePath(projectRoot, targetDirectoryAbsolute).replace(/\\/g, "/"),
      targetDirectoryAbsolute,
    };
  }

  return null;
}

function buildPreviewFiles(
  projectRoot: string,
  targetDirectory: string,
  files: Array<{ path: string; content: string }>,
): ModuleScaffoldFilePreview[] {
  return files.map((file) => {
    const previewPath = path.posix.join(targetDirectory, file.path).replace(/\\/g, "/");
    return {
      path: file.path,
      target_path: previewPath,
      content_preview: lineLimitPreview(file.content),
    };
  });
}

function previewTokenFailure(
  code: "E_PREVIEW_REQUIRED" | "E_PREVIEW_EXPIRED" | "E_PREVIEW_CONSUMED",
  message: string,
): WriteApplyResponse<ModuleScaffoldResultData> {
  return {
    status: "error",
    error: {
      code,
      message,
    },
  };
}

function checkPreviewToken(
  previewToken: string | undefined,
  targetDirectoryAbsolute: string,
): WriteApplyResponse<ModuleScaffoldResultData> | null {
  if (!previewToken) {
    return previewTokenFailure(
      "E_PREVIEW_REQUIRED",
      "A valid module scaffold preview token is required before applying the change.",
    );
  }

  const status = getPreviewTokenStatus(previewToken, {
    workflow: "module_scaffold",
    fingerprint: targetDirectoryAbsolute,
  });

  if (status === "active") {
    return null;
  }

  if (status === "consumed") {
    return previewTokenFailure(
      "E_PREVIEW_CONSUMED",
      "That module scaffold preview token has already been used.",
    );
  }

  if (status === "expired") {
    return previewTokenFailure(
      "E_PREVIEW_EXPIRED",
      "That module scaffold preview token has expired.",
    );
  }

  return previewTokenFailure(
    "E_PREVIEW_REQUIRED",
    "A module scaffold preview must be requested before applying the change.",
  );
}

function buildScaffoldPlanData(
  state: ServerState,
  input: ModuleScaffoldInput,
  dependencies: ModuleScaffoldDependencies = {},
): Promise<ResourceOrToolResponse<ScaffoldPlanData>> {
  return runScaffoldPlanning(state, input, {
    getManifest: dependencies.getManifest ?? getProjectManifest,
  });
}

export function parseModuleScaffoldInput(
  input: unknown,
): { ok: true; value: ModuleScaffoldInput } | { ok: false; response: ResourceOrToolResponse<never> } {
  return validateInput(input);
}

export async function runModuleScaffoldPreview(
  state: ServerState,
  input: ModuleScaffoldInput,
  dependencies: ModuleScaffoldDependencies = {},
): Promise<WritePreviewResponse<ModuleScaffoldPreviewData>> {
  const ensured = ensureConfig<ModuleScaffoldPreviewData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const target = resolveModuleTargetDirectory(ensured.config, input.machine_name);
  if (!target) {
    return {
      status: "error",
      error: {
        code: "E_PATH_UNSAFE",
        message: "The module scaffold target directory is outside the configured custom module paths.",
      },
    };
  }

  const planResponse = await buildScaffoldPlanData(state, input, dependencies);
  const manifestResponse = await (dependencies.getManifest ?? getProjectManifest)(state);
  const manifestData = manifestResponse.status === "ok" ? manifestResponse.data : null;
  const files = buildModuleFiles(ensured.config, input.machine_name, manifestData?.drupal_core_version ?? null);
  const targetExists = fs.existsSync(target.targetDirectoryAbsolute);
  const preview = {
    machine_name: input.machine_name,
    target_type: "module" as const,
    target_directory: target.targetDirectory,
    target_directory_exists: targetExists,
    files: buildPreviewFiles(target.projectRoot, target.targetDirectory, files),
    warnings: targetExists
      ? ["The target directory already exists; apply will be rejected."]
      : [],
  };
  const token = generatePreviewToken({
    workflow: "module_scaffold",
    fingerprint: target.targetDirectoryAbsolute,
  });

  return {
    status: planResponse.status,
    data: {
      preview,
      preview_token: token.token,
      expires_at: token.expiresAt.toISOString(),
    },
    error: planResponse.status === "ok" ? undefined : planResponse.error,
  };
}

function writeModuleFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export async function runModuleScaffoldApply(
  state: ServerState,
  input: unknown,
  dependencies: ModuleScaffoldDependencies = {},
): Promise<WriteApplyResponse<ModuleScaffoldResultData>> {
  const ensured = ensureConfig<ModuleScaffoldResultData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const validatedInput = validateInput(input);
  if (!validatedInput.ok) {
    return validatedInput.response;
  }

  const target = resolveModuleTargetDirectory(ensured.config, validatedInput.value.machine_name);
  if (!target) {
    return {
      status: "error",
      error: {
        code: "E_PATH_UNSAFE",
        message: "The module scaffold target directory is outside the configured custom module paths.",
      },
    };
  }

  if (fs.existsSync(target.targetDirectoryAbsolute)) {
    return {
      status: "error",
      error: {
        code: "E_INVALID_INPUT",
        message: "The module scaffold target directory already exists.",
      },
    };
  }

  const record = input as Record<string, unknown>;
  const previewToken = typeof record.preview_token === "string" ? record.preview_token : undefined;
  const tokenError = checkPreviewToken(previewToken, target.targetDirectoryAbsolute);
  if (tokenError) {
    return tokenError;
  }

  const manifestResponse = await (dependencies.getManifest ?? getProjectManifest)(state);
  const manifestData = manifestResponse.status === "ok" ? manifestResponse.data : null;
  const files = buildModuleFiles(ensured.config, validatedInput.value.machine_name, manifestData?.drupal_core_version ?? null);
  consumePreviewToken(previewToken!, {
    workflow: "module_scaffold",
    fingerprint: target.targetDirectoryAbsolute,
  });

  const createdFiles: string[] = [];
  for (const file of files) {
    const filePath = path.join(target.targetDirectoryAbsolute, file.path);
    writeModuleFile(filePath, file.content);
    createdFiles.push(path.posix.join(target.targetDirectory, file.path).replace(/\\/g, "/"));
  }

  const changes: WriteChange[] = createdFiles.map((filePath) => ({
    type: "file_created",
    target: filePath,
    detail: "Created module scaffold file.",
  }));

  return {
    status: "ok",
    data: {
      result: {
        machine_name: validatedInput.value.machine_name,
        target_type: "module",
        target_directory: target.targetDirectory,
        created_files: createdFiles,
      },
      changes,
    },
  };
}

function verifyModuleFile(targetPath: string, contentCheck: (content: string) => boolean): ModuleScaffoldVerificationFile {
  try {
    const content = fs.readFileSync(targetPath, "utf8");
    return {
      path: targetPath,
      exists: true,
      non_empty: content.trim().length > 0,
      valid: contentCheck(content),
    };
  } catch {
    return {
      path: targetPath,
      exists: false,
      non_empty: false,
      valid: false,
    };
  }
}

export async function runModuleScaffoldVerify(
  state: ServerState,
  input: ModuleScaffoldInput,
): Promise<WriteVerifyResponse<ModuleScaffoldVerificationData>> {
  const ensured = ensureConfig<ModuleScaffoldVerificationData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const target = resolveModuleTargetDirectory(ensured.config, input.machine_name);
  if (!target) {
    return {
      status: "error",
      error: {
        code: "E_PATH_UNSAFE",
        message: "The module scaffold target directory is outside the configured custom module paths.",
      },
    };
  }

  const expectedFiles = buildModuleFiles(ensured.config, input.machine_name, null);
  const verificationFiles = expectedFiles.map((file) => {
    const absoluteTarget = path.join(target.targetDirectoryAbsolute, file.path);
    const exists = fs.existsSync(absoluteTarget);
    let content = "";
    let nonEmpty = false;
    let valid = false;
    if (exists) {
      content = fs.readFileSync(absoluteTarget, "utf8");
      nonEmpty = content.trim().length > 0;
      if (file.path.endsWith(".info.yml")) {
        valid =
          content.includes("type: module") &&
          content.includes("core_version_requirement:") &&
          content.includes("package: Custom");
      } else if (file.path.endsWith(".module")) {
        valid = content.trimStart().startsWith("<?php") && content.includes("Hooks for the");
      } else if (file.path.endsWith(".routing.yml")) {
        valid = content.includes("defaults:") && content.includes("_controller:");
      } else if (file.path.endsWith("Controller.php")) {
        valid =
          content.trimStart().startsWith("<?php") &&
          content.includes(`namespace Drupal\\${input.machine_name}\\Controller;`) &&
          content.includes("class");
      }
    }

    return {
      path: path.posix.join(target.targetDirectory, file.path).replace(/\\/g, "/"),
      exists,
      non_empty: nonEmpty,
      valid,
    };
  });

  const verified = verificationFiles.every((file) => file.exists && file.non_empty && file.valid);
  const warnings = verified
    ? []
    : ["One or more scaffold files are missing, empty, or do not match the expected structure."];

  return {
    status: verified ? "ok" : "degraded",
    data: {
      verified,
      verification: {
        target_directory: target.targetDirectory,
        directory_exists: fs.existsSync(target.targetDirectoryAbsolute),
        files: verificationFiles,
      },
      warnings,
    },
  };
}
