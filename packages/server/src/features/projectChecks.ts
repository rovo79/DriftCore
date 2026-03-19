import type { ResourceOrToolResponse, ServerState } from "../types.js";
import { runDrushStatus } from "./drushTools.js";
import { collectProjectFacts, type ProjectCapabilities } from "./projectTruth.js";

export interface ProjectChecksData {
  drush_available: boolean;
  composer_available: boolean;
  drupal_root_valid: boolean;
  composer_json_present: boolean;
  config_sync_detected: boolean;
  warnings: string[];
  capabilities: ProjectCapabilities;
}

export type ProjectChecksResponse = ResourceOrToolResponse<ProjectChecksData>;

interface ProjectChecksDependencies {
  runStatus?: typeof runDrushStatus;
}

function emptyCapabilities(): ProjectCapabilities {
  return {
    can_read_project_manifest: false,
    can_inspect_modules: false,
    can_run_drush: false,
    can_run_composer: false,
    can_assess_config: false,
  };
}

function buildWarnings(input: {
  drushAvailable: boolean;
  composerAvailable: boolean;
  drupalRootValid: boolean;
  composerJsonPresent: boolean;
  configSyncDetected: boolean;
  configLayoutUncertain: boolean;
  configErrorMessage?: string;
}): string[] {
  const warnings: string[] = [];

  if (input.configErrorMessage) {
    warnings.push(input.configErrorMessage);
  }
  if (!input.drupalRootValid) {
    warnings.push("Configured Drupal root is missing or not a directory.");
  }
  if (!input.composerJsonPresent) {
    warnings.push("composer.json is missing at the resolved project root.");
  }
  if (!input.drushAvailable) {
    warnings.push("Drush executable is not available for project inspection.");
  }
  if (!input.composerAvailable) {
    warnings.push("Composer executable is not available for project inspection.");
  }
  if (!input.configSyncDetected) {
    warnings.push("Config sync directory could not be detected.");
  }
  if (input.configLayoutUncertain) {
    warnings.push("settings.php exists, but DriftCore could not determine the config sync directory.");
  }

  return warnings;
}

export async function getProjectChecks(
  state: ServerState,
  dependencies: ProjectChecksDependencies = {},
): Promise<ProjectChecksResponse> {
  if (!state.config) {
    return {
      status: "ok",
      data: {
        drush_available: false,
        composer_available: false,
        drupal_root_valid: false,
        composer_json_present: false,
        config_sync_detected: false,
        warnings: buildWarnings({
          drushAvailable: false,
          composerAvailable: false,
          drupalRootValid: false,
          composerJsonPresent: false,
          configSyncDetected: false,
          configLayoutUncertain: false,
          configErrorMessage: state.configError?.message,
        }),
        capabilities: emptyCapabilities(),
      },
    };
  }

  const drushStatusResponse = state.binaryValidation.drush.exists
    ? await (dependencies.runStatus ?? runDrushStatus)(state)
    : null;
  const facts = collectProjectFacts(state.config, state.binaryValidation, {
    drushStatus: drushStatusResponse?.status === "ok" ? drushStatusResponse.data : null,
  });

  return {
    status: "ok",
    data: {
      drush_available: facts.drushAvailable,
      composer_available: facts.composerAvailable,
      drupal_root_valid: facts.drupalRootValid,
      composer_json_present: facts.composerJsonPresent,
      config_sync_detected: facts.configLayout.configSyncDetected,
      warnings: buildWarnings({
        drushAvailable: facts.drushAvailable,
        composerAvailable: facts.composerAvailable,
        drupalRootValid: facts.drupalRootValid,
        composerJsonPresent: facts.composerJsonPresent,
        configSyncDetected: facts.configLayout.configSyncDetected,
        configLayoutUncertain: facts.configLayout.configLayoutUncertain,
      }),
      capabilities: facts.capabilities,
    },
  };
}
