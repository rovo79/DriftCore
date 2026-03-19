import fs from "node:fs";
import path from "node:path";
import type { ResourceOrToolResponse, ServerConfig, ServerState } from "../../types.js";
import { runDrushStatus } from "../drushTools.js";
import { mapCliResultToError, redactPaths, truncateStderr } from "../errorMapping.js";
import { resolveProjectRoot } from "../projectPaths.js";
import { detectConfigLayout, type ConfigLayoutDetection } from "../projectTruth.js";
import {
  runCliCommand,
  type CliExecutionOptions,
  type CliExecutionResult,
} from "../sandboxExecution.js";

export interface ConfigDriftChange {
  name: string;
  state: "new" | "changed" | "deleted";
}

export interface ConfigDriftAssessmentData {
  sync_directory: string | null;
  sync_directory_exists: boolean;
  has_config_split: boolean;
  drift_detected: boolean;
  changed_items: ConfigDriftChange[];
  summary: string;
  suggested_commands: string[];
}

export type ConfigDriftAssessmentResponse = ResourceOrToolResponse<ConfigDriftAssessmentData>;

interface ConfigDriftAssessmentDependencies {
  runStatus?: typeof runDrushStatus;
  runConfigStatus?: typeof runDrushConfigStatus;
}

interface ConfigStatusEntry {
  name: string;
  state: ConfigDriftChange["state"];
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

function resolveDrushCommand(config: ServerConfig): string {
  if (config.drushPath) {
    return config.drushPath;
  }

  const projectRoot = resolveProjectRoot(config);
  const vendorDrush = path.join(projectRoot, "vendor", "bin", "drush");
  if (fs.existsSync(vendorDrush)) {
    return vendorDrush;
  }

  return "drush";
}

function parseJsonOutput(raw: string): unknown {
  const firstBrace = raw.search(/[\[{]/);
  if (firstBrace === -1) {
    throw new Error("Drush output did not contain JSON data");
  }

  return JSON.parse(raw.slice(firstBrace).trim()) as unknown;
}

function toConfigDriftState(state: unknown): ConfigDriftChange["state"] | null {
  const normalised = typeof state === "string" ? state.trim() : "";
  switch (normalised) {
    case "Only in sync dir":
      return "new";
    case "Only in DB":
      return "deleted";
    case "Different":
      return "changed";
    default:
      return null;
  }
}

function normaliseConfigStatusOutput(raw: unknown): ConfigDriftChange[] {
  const entries: ConfigStatusEntry[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;
      const state = toConfigDriftState(record.state);
      if (name && state) {
        entries.push({ name, state });
      }
    }
  } else if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const candidates = Array.isArray(record.rows)
      ? record.rows
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.config)
          ? record.config
          : null;

    if (candidates) {
      for (const item of candidates) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const nested = item as Record<string, unknown>;
        const name = typeof nested.name === "string" ? nested.name : null;
        const state = toConfigDriftState(nested.state);
        if (name && state) {
          entries.push({ name, state });
        }
      }
    } else {
      for (const [name, value] of Object.entries(record)) {
        if (value && typeof value === "object") {
          const nested = value as Record<string, unknown>;
          const state = toConfigDriftState(nested.state);
          if (state) {
            entries.push({ name, state });
          }
          continue;
        }

        const state = toConfigDriftState(value);
        if (state) {
          entries.push({ name, state });
        }
      }
    }
  }

  return entries
    .map((entry) => ({
      name: entry.name,
      state: entry.state,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function pathIsNonEmptyDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory() && fs.readdirSync(target).length > 0;
  } catch {
    return false;
  }
}

function buildSummary(
  layout: ConfigLayoutDetection,
  syncDirectoryExists: boolean,
  driftDetected: boolean,
  configStatusAvailable: boolean,
): string {
  if (!layout.configSyncDetected && !layout.hasConfigSplit && layout.environmentIndicators.length === 0) {
    return "No config sync directory could be detected for this Drupal project.";
  }

  if (!syncDirectoryExists) {
    return layout.syncDirectory
      ? `The config sync directory at ${layout.syncDirectory} is missing or empty.`
      : "A config sync directory could not be confirmed from the filesystem.";
  }

  if (!configStatusAvailable) {
    return "Config sync was detected, but Drush config status was unavailable.";
  }

  if (driftDetected) {
    return "Configuration drift was detected between active storage and the sync directory.";
  }

  return "Config sync directory is present and Drush reported no pending differences.";
}

function buildSuggestedCommands(driftDetected: boolean, configStatusAvailable: boolean): string[] {
  if (!configStatusAvailable) {
    return [];
  }

  if (!driftDetected) {
    return [];
  }

  return ["drush config:import -y", "drush cache:rebuild"];
}

async function runDrushConfigStatus(
  state: ServerState,
  runner: (options: CliExecutionOptions) => Promise<CliExecutionResult> = runCliCommand,
): Promise<ResourceOrToolResponse<ConfigDriftChange[]>> {
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

  const config = state.config;
  const redaction = config.redaction;
  const command = resolveDrushCommand(config);
  const args = ["config:status", "--format=json"];
  const cliResult = await runner({
    command,
    args,
    cwd: config.drupalRoot,
    timeoutMs: config.timeouts?.drushStatusMs ?? 10000,
    maxParallel: config.maxParallelCli ?? 1,
  });

  if (cliResult.timedOut || cliResult.exitCode !== 0) {
    return mapCliResultToError<ConfigDriftChange[]>(
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
      redaction,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseJsonOutput(cliResult.stdout);
  } catch (error) {
    return {
      status: "error",
      error: {
        code: "E_JSON_PARSE",
        message: "Failed to parse Drush config:status output as JSON",
        diagnostics: {
          command: redactPaths(command, redaction),
          args,
        },
        details: { error: redactPaths((error as Error).message, redaction) },
        stderr: truncateStderr(cliResult.stderr, redaction),
      },
    };
  }

  return {
    status: "ok",
    data: normaliseConfigStatusOutput(parsed),
  };
}

export async function runConfigDriftAssessment(
  state: ServerState,
  dependencies: ConfigDriftAssessmentDependencies = {},
): Promise<ConfigDriftAssessmentResponse> {
  const ensured = ensureConfig<ConfigDriftAssessmentData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }

  const runStatus = dependencies.runStatus ?? runDrushStatus;
  const runConfigStatus = dependencies.runConfigStatus ?? runDrushConfigStatus;

  const drushStatusResponse = await runStatus(state);
  const layout = detectConfigLayout(ensured.config, {
    drushStatus: drushStatusResponse.status === "ok" ? drushStatusResponse.data : null,
  });

  const projectRoot = resolveProjectRoot(ensured.config);
  const syncDirectory =
    typeof layout.syncDirectory === "string" ? path.resolve(projectRoot, layout.syncDirectory) : null;
  const syncDirectoryExists = syncDirectory ? pathIsNonEmptyDirectory(syncDirectory) : false;

  if (!layout.configSyncDetected && !layout.hasConfigSplit && layout.environmentIndicators.length === 0) {
    return {
      status: "not_configured",
      error: {
        code: "E_CONFIG_SYNC_NOT_DETECTED",
        message: "No config sync directory could be detected for this Drupal project.",
      },
    };
  }

  if (drushStatusResponse.status !== "ok" || !syncDirectoryExists) {
    return {
      status: "degraded",
      data: {
        sync_directory: layout.syncDirectory,
        sync_directory_exists: syncDirectoryExists,
        has_config_split: layout.hasConfigSplit,
        drift_detected: false,
        changed_items: [],
        summary: buildSummary(layout, syncDirectoryExists, false, false),
        suggested_commands: buildSuggestedCommands(false, false),
      },
      error:
        drushStatusResponse.error ??
        {
          code: "E_CONFIG_DRIFT_INCOMPLETE",
          message: "Drush config status was unavailable; returning filesystem-only config drift data.",
        },
    };
  }

  const configStatusResponse = await runConfigStatus(state);
  if (configStatusResponse.status !== "ok") {
    return {
      status: "degraded",
      data: {
        sync_directory: layout.syncDirectory,
        sync_directory_exists: syncDirectoryExists,
        has_config_split: layout.hasConfigSplit,
        drift_detected: false,
        changed_items: [],
        summary: buildSummary(layout, syncDirectoryExists, false, false),
        suggested_commands: buildSuggestedCommands(false, false),
      },
      error:
        configStatusResponse.error ??
        {
          code: "E_CONFIG_DRIFT_INCOMPLETE",
          message: "Drush config status was unavailable; returning filesystem-only config drift data.",
        },
    };
  }

  const changedItems = configStatusResponse.data ?? [];
  const driftDetected = changedItems.length > 0;

  return {
    status: "ok",
    data: {
      sync_directory: layout.syncDirectory,
      sync_directory_exists: syncDirectoryExists,
      has_config_split: layout.hasConfigSplit,
      drift_detected: driftDetected,
      changed_items: changedItems,
      summary: buildSummary(layout, syncDirectoryExists, driftDetected, true),
      suggested_commands: buildSuggestedCommands(driftDetected, true),
    },
  };
}
