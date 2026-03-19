import type { ResourceOrToolResponse, ServerState } from "../../types.js";
import {
  runComposerInfo,
  runComposerOutdated,
  type ComposerOutdatedPackage,
} from "../composerTools.js";
import { getProjectManifest } from "../projectManifest.js";

export interface UpgradeCandidate {
  name: string;
  current_version: string;
  latest_version: string | null;
  constraint: string | undefined;
  package_type: ComposerOutdatedPackage["package_type"];
  risk: "low" | "medium" | "high";
  reason: string;
}

export interface UpgradeAssessmentData {
  drupal_core_version: string | null;
  project_type: string | null;
  total_outdated: number;
  candidates: UpgradeCandidate[];
  summary: string;
  suggested_commands: string[];
}

export type UpgradeAssessmentResponse = ResourceOrToolResponse<UpgradeAssessmentData>;

interface UpgradeAssessmentDependencies {
  runOutdated?: typeof runComposerOutdated;
  runInfo?: typeof runComposerInfo;
  getManifest?: typeof getProjectManifest;
}

function ensureConfig<T>(
  state: ServerState,
): { config: NonNullable<ServerState["config"]> } | ResourceOrToolResponse<T> {
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

function isOkResponse<T>(
  response: ResourceOrToolResponse<T>,
): response is { status: "ok"; data: T } {
  return response.status === "ok" && response.data !== undefined;
}

function firstNonOkError(
  responses: Array<ResourceOrToolResponse<unknown>>,
): ResourceOrToolResponse<unknown>["error"] | undefined {
  for (const response of responses) {
    if (response.status !== "ok") {
      return response.error;
    }
  }
  return undefined;
}

function parseVersionSegments(version: string | null | undefined): number[] | null {
  if (!version) {
    return null;
  }

  const numericParts = version.match(/\d+/g);
  if (!numericParts || numericParts.length === 0) {
    return null;
  }

  return numericParts.map((part) => Number.parseInt(part, 10));
}

function determineBumpKind(
  currentVersion: string,
  latestVersion: string | null,
): "major" | "minor" | "patch" | "unknown" {
  const currentSegments = parseVersionSegments(currentVersion);
  const latestSegments = parseVersionSegments(latestVersion);
  if (!currentSegments || !latestSegments) {
    return "unknown";
  }

  const [currentMajor = 0, currentMinor = 0, currentPatch = 0] = currentSegments;
  const [latestMajor = 0, latestMinor = 0, latestPatch = 0] = latestSegments;

  if (latestMajor !== currentMajor) {
    return "major";
  }

  if (latestMinor !== currentMinor) {
    return "minor";
  }

  if (latestPatch !== currentPatch) {
    return "patch";
  }

  return "unknown";
}

function classifyRisk(
  packageType: ComposerOutdatedPackage["package_type"],
  currentVersion: string,
  latestVersion: string | null,
): { risk: "low" | "medium" | "high"; reason: string } {
  const bumpKind = determineBumpKind(currentVersion, latestVersion);
  const versionLabel = latestVersion ? `${currentVersion} -> ${latestVersion}` : currentVersion;

  if (packageType === "drupal-core") {
    return {
      risk: "high",
      reason:
        bumpKind === "major"
          ? `Major version upgrade from ${versionLabel}`
          : `Drupal core package update from ${versionLabel}`,
    };
  }

  if (bumpKind === "major") {
    return {
      risk: "high",
      reason: `Major version upgrade from ${versionLabel}`,
    };
  }

  if (packageType === "drupal-module" || packageType === "drupal-theme") {
    if (bumpKind === "minor") {
      return {
        risk: "medium",
        reason: `Minor update for Drupal ${packageType === "drupal-module" ? "module" : "theme"} from ${versionLabel}`,
      };
    }

    if (bumpKind === "patch") {
      return {
        risk: "low",
        reason: `Patch-level update for Drupal ${packageType === "drupal-module" ? "module" : "theme"} from ${versionLabel}`,
      };
    }

    return {
      risk: "medium",
      reason: `Drupal ${packageType === "drupal-module" ? "module" : "theme"} update from ${versionLabel}`,
    };
  }

  if (bumpKind === "patch") {
    return {
      risk: "low",
      reason: `Patch-level update for library package from ${versionLabel}`,
    };
  }

  return {
    risk: "low",
    reason: `Library package update from ${versionLabel}`,
  };
}

function toUpgradeCandidate(
  packageData: ComposerOutdatedPackage,
): UpgradeCandidate {
  const riskInfo = classifyRisk(
    packageData.package_type,
    packageData.current_version,
    packageData.latest_version,
  );

  return {
    name: packageData.name,
    current_version: packageData.current_version,
    latest_version: packageData.latest_version,
    constraint: packageData.constraint,
    package_type: packageData.package_type,
    risk: riskInfo.risk,
    reason: riskInfo.reason,
  };
}

function buildSuggestedCommands(candidates: UpgradeCandidate[]): string[] {
  const commands = new Set<string>();
  let hasDrupalPackages = false;

  for (const candidate of candidates) {
    const packageName =
      candidate.package_type === "drupal-core" &&
      (candidate.name === "drupal/core" || candidate.name === "drupal/core-recommended")
        ? "drupal/core-recommended"
        : candidate.name;

    commands.add(`composer update ${packageName} --with-dependencies`);

    if (candidate.package_type === "drupal-core" || candidate.package_type === "drupal-module" || candidate.package_type === "drupal-theme") {
      hasDrupalPackages = true;
    }
  }

  if (hasDrupalPackages) {
    commands.add("drush updatedb");
    commands.add("drush cache:rebuild");
  }

  return Array.from(commands);
}

function buildSummary(
  projectType: string | null,
  candidates: UpgradeCandidate[],
  degraded: boolean,
): string {
  const typeSuffix = projectType ? ` for ${projectType}` : "";

  if (degraded && candidates.length === 0) {
    return `Composer upgrade assessment could not be completed${typeSuffix}.`;
  }

  if (candidates.length === 0) {
    return `No outdated packages were detected${typeSuffix}.`;
  }

  const riskCounts = {
    high: candidates.filter((candidate) => candidate.risk === "high").length,
    medium: candidates.filter((candidate) => candidate.risk === "medium").length,
    low: candidates.filter((candidate) => candidate.risk === "low").length,
  };

  return `${candidates.length} outdated package${candidates.length === 1 ? "" : "s"} detected${typeSuffix}: ${riskCounts.high} high risk, ${riskCounts.medium} medium risk, ${riskCounts.low} low risk.`;
}

export async function runUpgradeAssessment(
  state: ServerState,
  dependencies: UpgradeAssessmentDependencies = {},
): Promise<UpgradeAssessmentResponse> {
  const ensured = ensureConfig<UpgradeAssessmentData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }

  const runOutdated = dependencies.runOutdated ?? runComposerOutdated;
  const runInfo = dependencies.runInfo ?? runComposerInfo;
  const getManifest = dependencies.getManifest ?? getProjectManifest;

  const [outdatedResponse, infoResponse, manifestResponse] = await Promise.all([
    runOutdated(state),
    runInfo(state),
    getManifest(state),
  ]);

  const outdatedPackages = isOkResponse(outdatedResponse) ? outdatedResponse.data.packages : [];
  const candidates = outdatedPackages.map(toUpgradeCandidate);
  const degraded = [outdatedResponse, infoResponse, manifestResponse].some(
    (response) => response.status !== "ok",
  );

  const manifestData = isOkResponse(manifestResponse) ? manifestResponse.data : undefined;
  const infoData = isOkResponse(infoResponse) ? infoResponse.data : undefined;

  const data: UpgradeAssessmentData = {
    drupal_core_version:
      manifestData?.drupal_core_version ?? infoData?.lock_summary?.packages?.find((pkg) => pkg.name === "drupal/core-recommended" || pkg.name === "drupal/core")?.version ?? null,
    project_type: manifestData?.project_type ?? null,
    total_outdated: candidates.length,
    candidates,
    summary: buildSummary(manifestData?.project_type ?? null, candidates, degraded),
    suggested_commands: buildSuggestedCommands(candidates),
  };

  if (degraded) {
    return {
      status: "degraded",
      data,
      error:
        firstNonOkError([outdatedResponse, infoResponse, manifestResponse]) ?? {
          code: "E_UPGRADE_ASSESSMENT_PARTIAL",
          message: "Upgrade assessment could not be completed from all available sources.",
        },
    };
  }

  return {
    status: "ok",
    data,
  };
}
