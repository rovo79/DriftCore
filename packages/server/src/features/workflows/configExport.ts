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
import { runConfigDriftAssessment, type ConfigDriftAssessmentData } from "./configDriftAssessment.js";
import { resolveDrushCommand } from "../drushCommand.js";
import { detectConfigLayout } from "../projectTruth.js";
import { resolveProjectRoot } from "../projectPaths.js";
import {
  consumePreviewToken,
  generatePreviewToken,
  getPreviewTokenStatus,
} from "../writeLifecycle.js";
import {
  runCliCommand,
  type CliExecutionOptions,
  type CliExecutionResult,
} from "../sandboxExecution.js";
import { mapCliResultToError } from "../errorMapping.js";

export interface ConfigExportPreviewData {
  sync_directory: string | null;
  sync_directory_exists: boolean;
  changed_items: ConfigDriftAssessmentData["changed_items"];
  export_command: string;
  drift_detected: boolean;
}

export interface ConfigExportResultData {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
  duration_ms: number;
  sync_directory: string;
  changed_files: string[];
}

export interface ConfigExportVerificationData {
  sync_directory: string | null;
  drift_detected: boolean;
  changed_items: ConfigDriftAssessmentData["changed_items"];
}

export interface ConfigExportApplyInput {
  preview_token?: string;
}

interface ConfigExportDependencies {
  runCommand?: (options: CliExecutionOptions) => Promise<CliExecutionResult>;
  runAssessment?: typeof runConfigDriftAssessment;
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

function resolveSyncDirectory(config: ServerConfig): { projectRoot: string; syncDirectory: string | null; syncDirectoryAbsolute: string | null } {
  const projectRoot = resolveProjectRoot(config);
  const layout = detectConfigLayout(config);
  if (!layout.syncDirectory) {
    return {
      projectRoot,
      syncDirectory: null,
      syncDirectoryAbsolute: null,
    };
  }

  return {
    projectRoot,
    syncDirectory: layout.syncDirectory,
    syncDirectoryAbsolute: path.resolve(projectRoot, layout.syncDirectory),
  };
}

function listFilesRecursively(root: string): Array<{ path: string; content: string }> {
  const entries: Array<{ path: string; content: string }> = [];
  if (!fs.existsSync(root)) {
    return entries;
  }

  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        entries.push({
          path: absolutePath,
          content: fs.readFileSync(absolutePath, "utf8"),
        });
      }
    }
  };

  walk(root);
  return entries;
}

function snapshotDirectory(root: string, projectRoot: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const file of listFilesRecursively(root)) {
    snapshot.set(path.relative(projectRoot, file.path).replace(/\\/g, "/"), file.content);
  }
  return snapshot;
}

function diffSnapshots(
  before: Map<string, string>,
  after: Map<string, string>,
): WriteChange[] {
  const changes: WriteChange[] = [];
  for (const [filePath, content] of after.entries()) {
    if (!before.has(filePath)) {
      changes.push({
        type: "file_created",
        target: filePath,
        detail: "Config file was created during export.",
      });
      continue;
    }

    if (before.get(filePath) !== content) {
      changes.push({
        type: "file_modified",
        target: filePath,
        detail: "Config file contents changed during export.",
      });
    }
  }

  return changes;
}

function previewTokenFailure(
  code: "E_PREVIEW_REQUIRED" | "E_PREVIEW_EXPIRED" | "E_PREVIEW_CONSUMED",
  message: string,
): WriteApplyResponse<ConfigExportResultData> {
  return {
    status: "error",
    error: { code, message },
  };
}

function checkPreviewToken(
  previewToken: string | undefined,
): WriteApplyResponse<ConfigExportResultData> | null {
  if (!previewToken) {
    return previewTokenFailure(
      "E_PREVIEW_REQUIRED",
      "A valid config export preview token is required before applying the change.",
    );
  }

  const status = getPreviewTokenStatus(previewToken, { workflow: "config_export" });
  if (status === "active") {
    return null;
  }

  if (status === "consumed") {
    return previewTokenFailure(
      "E_PREVIEW_CONSUMED",
      "That config export preview token has already been used.",
    );
  }

  if (status === "expired") {
    return previewTokenFailure(
      "E_PREVIEW_EXPIRED",
      "That config export preview token has expired.",
    );
  }

  return previewTokenFailure(
    "E_PREVIEW_REQUIRED",
    "A config export preview must be requested before applying the change.",
  );
}

export async function runConfigExportPreview(
  state: ServerState,
  dependencies: ConfigExportDependencies = {},
): Promise<WritePreviewResponse<ConfigExportPreviewData>> {
  const ensured = ensureConfig<ConfigExportPreviewData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const assessment = await (dependencies.runAssessment ?? runConfigDriftAssessment)(state);
  const syncDirectory = assessment.data?.sync_directory ?? null;
  if (!syncDirectory) {
    return assessment as WritePreviewResponse<ConfigExportPreviewData>;
  }

  const token = generatePreviewToken({
    workflow: "config_export",
    fingerprint: syncDirectory,
  });

  return {
    status: assessment.status,
    data: {
      preview: {
        sync_directory: syncDirectory,
        sync_directory_exists: assessment.data?.sync_directory_exists ?? false,
        changed_items: assessment.data?.changed_items ?? [],
        export_command: "drush config:export -y",
        drift_detected: assessment.data?.drift_detected ?? false,
      },
      preview_token: token.token,
      expires_at: token.expiresAt.toISOString(),
    },
    error: assessment.status === "ok" ? undefined : assessment.error,
  };
}

export async function runConfigExportApply(
  state: ServerState,
  input: ConfigExportApplyInput,
  dependencies: ConfigExportDependencies = {},
): Promise<WriteApplyResponse<ConfigExportResultData>> {
  const ensured = ensureConfig<ConfigExportResultData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const tokenError = checkPreviewToken(input.preview_token);
  if (tokenError) {
    return tokenError;
  }

  const { config } = ensured;
  const resolved = resolveSyncDirectory(config);
  if (!resolved.syncDirectory || !resolved.syncDirectoryAbsolute) {
    return {
      status: "not_configured",
      error: {
        code: "E_CONFIG_SYNC_NOT_DETECTED",
        message: "No config sync directory could be detected for this Drupal project.",
      },
    };
  }

  const command = resolveDrushCommand(config);
  const args = ["config:export", "-y"];
  const runner = dependencies.runCommand ?? runCliCommand;
  const previewToken = input.preview_token as string;
  const before = snapshotDirectory(resolved.syncDirectoryAbsolute, resolved.projectRoot);

  consumePreviewToken(previewToken, {
    workflow: "config_export",
    fingerprint: resolved.syncDirectory,
  });

  const cliResult = await runner({
    command,
    args,
    cwd: config.drupalRoot,
    timeoutMs: config.timeouts?.drushStatusMs ?? 10000,
    maxParallel: config.maxParallelCli ?? 1,
  });

  if (cliResult.timedOut || cliResult.exitCode !== 0) {
    return mapCliResultToError<ConfigExportResultData>(
      cliResult,
      {
        command,
        args,
        cwd: config.drupalRoot,
      },
      {
        missingBinaryCode: "E_DRUSH_NOT_FOUND",
        missingBinaryMessage:
          "Drush executable was not found. Install Drush or update the configuration.",
      },
      config.redaction,
    ) as WriteApplyResponse<ConfigExportResultData>;
  }

  const after = snapshotDirectory(resolved.syncDirectoryAbsolute, resolved.projectRoot);
  const changes = diffSnapshots(before, after);

  return {
    status: "ok",
    data: {
      result: {
        command: `${command} ${args.join(" ")}`,
        stdout: cliResult.stdout,
        stderr: cliResult.stderr,
        exit_code: cliResult.exitCode,
        timed_out: cliResult.timedOut,
        duration_ms: cliResult.durationMs,
        sync_directory: resolved.syncDirectory,
        changed_files: changes.map((change) => change.target),
      },
      changes: [
        {
          type: "command_executed",
          target: "drush config:export -y",
          detail: "Exported configuration to the sync directory.",
        },
        ...changes,
      ],
    },
  };
}

export async function runConfigExportVerify(
  state: ServerState,
  dependencies: ConfigExportDependencies = {},
): Promise<WriteVerifyResponse<ConfigExportVerificationData>> {
  const ensured = ensureConfig<ConfigExportVerificationData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const assessment = await (dependencies.runAssessment ?? runConfigDriftAssessment)(state);
  const verification = {
    sync_directory: assessment.data?.sync_directory ?? null,
    drift_detected: assessment.data?.drift_detected ?? false,
    changed_items: assessment.data?.changed_items ?? [],
  };
  const verified = assessment.status === "ok" && verification.drift_detected === false;

  return {
    status: verified ? "ok" : "degraded",
    data: {
      verified,
      verification,
      warnings: verified
        ? []
        : [
            assessment.error?.message ??
              "Config export verification could not confirm that the sync directory is clean.",
          ],
    },
    error: assessment.status === "ok" ? undefined : assessment.error,
  };
}
