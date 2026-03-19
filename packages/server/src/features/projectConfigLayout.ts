import type { ErrorDetail, ResourceOrToolResponse, ServerConfig, ServerState } from "../types.js";
import { runDrushStatus } from "./drushTools.js";
import { detectConfigLayout } from "./projectTruth.js";

export interface ProjectConfigLayoutData {
  sync_directory: string | null;
  has_config_split: boolean;
  environment_indicators: string[];
  detection_method: "drush" | "filesystem" | "none";
}

export type ProjectConfigLayoutResponse = ResourceOrToolResponse<ProjectConfigLayoutData>;

interface ProjectConfigLayoutDependencies {
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

function toResponseData(
  config: ServerConfig,
  state: ServerState,
  dependencies: ProjectConfigLayoutDependencies,
) {
  return async () => {
    const drushStatusResponse = await (dependencies.runStatus ?? runDrushStatus)(state);
    const layout = detectConfigLayout(config, {
      drushStatus: drushStatusResponse.status === "ok" ? drushStatusResponse.data : null,
    });

    const data: ProjectConfigLayoutData = {
      sync_directory: layout.syncDirectory,
      has_config_split: layout.hasConfigSplit,
      environment_indicators: layout.environmentIndicators,
      detection_method: layout.detectionMethod,
    };

    if (layout.configSyncDetected) {
      return {
        status: "ok" as const,
        data,
      };
    }

    const drushFailureSuggestsUncertainty =
      drushStatusResponse.status === "timeout" ||
      (drushStatusResponse.status === "error" &&
        drushStatusResponse.error?.code !== "E_DRUSH_NOT_FOUND");

    if (
      layout.configLayoutUncertain ||
      layout.hasConfigSplit ||
      layout.environmentIndicators.length > 0 ||
      drushFailureSuggestsUncertainty
    ) {
      return {
        status: "degraded" as const,
        data,
        error:
          drushStatusResponse.error ??
          ({
            code: "E_CONFIG_LAYOUT_UNCERTAIN",
            message: "Config layout indicators were found, but the sync directory could not be detected.",
          } satisfies ErrorDetail),
      };
    }

    return {
      status: "not_configured" as const,
      error: {
        code: "E_CONFIG_SYNC_NOT_DETECTED",
        message: "No config sync directory could be detected for this Drupal project.",
      },
    };
  };
}

export async function getProjectConfigLayout(
  state: ServerState,
  dependencies: ProjectConfigLayoutDependencies = {},
): Promise<ProjectConfigLayoutResponse> {
  const ensured = ensureConfig<ProjectConfigLayoutData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }

  return toResponseData(ensured.config, state, dependencies)();
}
