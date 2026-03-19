import type {
  ResourceOrToolResponse,
  ServerConfig,
  ServerState,
  WriteApplyResponse,
  WritePreviewResponse,
  WriteVerifyResponse,
} from "../../types.js";
import { runDrushStatus, type DrushStatusData } from "../drushTools.js";
import { mapCliResultToError } from "../errorMapping.js";
import { resolveDrushCommand } from "../drushCommand.js";
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

export interface CacheRebuildPreviewData {
  command: string;
  effect: string;
  timeout_ms: number;
}

export interface CacheRebuildResultData {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
  duration_ms: number;
}

export interface CacheRebuildVerificationData {
  drupal_version: string | null;
  php_version: string | null;
  database_driver: string | null;
  site_path: string | null;
  responsive: boolean;
}

export interface CacheRebuildApplyInput {
  preview_token?: string;
}

interface CacheRebuildDependencies {
  runCommand?: (options: CliExecutionOptions) => Promise<CliExecutionResult>;
  runStatus?: typeof runDrushStatus;
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

function previewResponse(
  config: ServerConfig,
): WritePreviewResponse<CacheRebuildPreviewData> {
  const command = resolveDrushCommand(config);
  const timeoutMs = config.timeouts?.drushStatusMs ?? 10000;
  const token = generatePreviewToken({
    workflow: "cache_rebuild",
    fingerprint: command,
  });

  return {
    status: "ok",
    data: {
      preview: {
        command: `${command} cache:rebuild`,
        effect: "clears all Drupal caches",
        timeout_ms: timeoutMs,
      },
      preview_token: token.token,
      expires_at: token.expiresAt.toISOString(),
    },
  };
}

function invalidPreviewTokenResponse(
  code: "E_PREVIEW_REQUIRED" | "E_PREVIEW_EXPIRED" | "E_PREVIEW_CONSUMED",
  message: string,
): WriteApplyResponse<CacheRebuildResultData> {
  return {
    status: "error",
    error: {
      code,
      message,
    },
  };
}

function previewTokenError(
  previewToken: string | undefined,
): WriteApplyResponse<CacheRebuildResultData> | null {
  if (!previewToken) {
    return invalidPreviewTokenResponse(
      "E_PREVIEW_REQUIRED",
      "A valid cache rebuild preview token is required before applying the change.",
    );
  }

  const status = getPreviewTokenStatus(previewToken, { workflow: "cache_rebuild" });
  if (status === "active") {
    return null;
  }

  if (status === "consumed") {
    return invalidPreviewTokenResponse(
      "E_PREVIEW_CONSUMED",
      "That cache rebuild preview token has already been used.",
    );
  }

  if (status === "expired") {
    return invalidPreviewTokenResponse(
      "E_PREVIEW_EXPIRED",
      "That cache rebuild preview token has expired.",
    );
  }

  return invalidPreviewTokenResponse(
    "E_PREVIEW_REQUIRED",
    "A cache rebuild preview must be requested before applying the change.",
  );
}

export async function runCacheRebuildPreview(
  state: ServerState,
): Promise<WritePreviewResponse<CacheRebuildPreviewData>> {
  const ensured = ensureConfig<CacheRebuildPreviewData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  return previewResponse(ensured.config);
}

export async function runCacheRebuildApply(
  state: ServerState,
  input: CacheRebuildApplyInput,
  dependencies: CacheRebuildDependencies = {},
): Promise<WriteApplyResponse<CacheRebuildResultData>> {
  const ensured = ensureConfig<CacheRebuildResultData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }

  const tokenError = previewTokenError(input.preview_token);
  if (tokenError) {
    return tokenError;
  }

  const { config } = ensured;
  const command = resolveDrushCommand(config);
  const args = ["cache:rebuild"];
  const runner = dependencies.runCommand ?? runCliCommand;
  const previewToken = input.preview_token as string;

  if (!consumePreviewToken(previewToken, { workflow: "cache_rebuild", fingerprint: command })) {
    return invalidPreviewTokenResponse(
      "E_PREVIEW_CONSUMED",
      "That cache rebuild preview token has already been used.",
    );
  }

  const cliResult = await runner({
    command,
    args,
    cwd: config.drupalRoot,
    timeoutMs: config.timeouts?.drushStatusMs ?? 10000,
    maxParallel: config.maxParallelCli ?? 1,
  });

  if (cliResult.timedOut || cliResult.exitCode !== 0) {
    return mapCliResultToError<CacheRebuildResultData>(
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
    ) as WriteApplyResponse<CacheRebuildResultData>;
  }

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
      },
      changes: [
        {
          type: "command_executed",
          target: "drush cache:rebuild",
          detail: "Cleared Drupal caches.",
        },
      ],
    },
  };
}

export async function runCacheRebuildVerify(
  state: ServerState,
  dependencies: CacheRebuildDependencies = {},
): Promise<WriteVerifyResponse<CacheRebuildVerificationData>> {
  const ensured = ensureConfig<CacheRebuildVerificationData>(state);
  if (!("config" in ensured)) {
    return {
      status: ensured.status,
      error: ensured.error,
    };
  }
  const statusResponse = await (dependencies.runStatus ?? runDrushStatus)(state);

  if (statusResponse.status !== "ok" || !statusResponse.data) {
    return {
      status: statusResponse.status === "not_configured" ? "not_configured" : "degraded",
      data: {
        verified: false,
        verification: {
          drupal_version: null,
          php_version: null,
          database_driver: null,
          site_path: null,
          responsive: false,
        },
        warnings: [
          statusResponse.error?.message ??
            "Drush status could not confirm that the site remained responsive after cache rebuild.",
        ],
      },
      error: statusResponse.error,
    };
  }

  const data = statusResponse.data;
  return {
    status: "ok",
    data: {
      verified: true,
      verification: {
        drupal_version: data.drupal_version,
        php_version: data.php_version,
        database_driver: data.database_driver,
        site_path: data.site_path,
        responsive: true,
      },
      warnings: [],
    },
  };
}
