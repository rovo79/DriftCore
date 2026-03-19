import fs from "node:fs";
import path from "node:path";
import type { BinaryValidationResult, ServerConfig } from "../types.js";
import type { DrushStatusData } from "./drushTools.js";
import { readJsonFile, resolveProjectRoot, toProjectRelativePath } from "./projectPaths.js";

export interface ProjectCapabilities {
  can_read_project_manifest: boolean;
  can_inspect_modules: boolean;
  can_run_drush: boolean;
  can_run_composer: boolean;
  can_assess_config: boolean;
}

export interface ProjectItem {
  name: string;
  path: string;
}

export interface ConfigLayoutDetection {
  syncDirectory: string | null;
  hasConfigSplit: boolean;
  environmentIndicators: string[];
  detectionMethod: "drush" | "filesystem" | "none";
  configSyncDetected: boolean;
  configLayoutUncertain: boolean;
}

export interface ProjectFacts {
  projectRoot: string;
  drupalRootValid: boolean;
  composerJsonPresent: boolean;
  drushAvailable: boolean;
  composerAvailable: boolean;
  configLayout: ConfigLayoutDetection;
  capabilities: ProjectCapabilities;
}

interface ConfigLayoutOptions {
  drushStatus?: DrushStatusData | null;
}

function pathIsDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function pathIsFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function normaliseProjectPath(
  projectRoot: string,
  drupalRoot: string,
  candidatePath: string,
): string {
  const absoluteCandidate = resolveDiscoveredPath(projectRoot, drupalRoot, candidatePath);
  return toProjectRelativePath(projectRoot, absoluteCandidate).replace(/\\/g, "/");
}

function resolveDiscoveredPath(
  projectRoot: string,
  drupalRoot: string,
  candidatePath: string,
): string {
  if (path.isAbsolute(candidatePath)) {
    return candidatePath;
  }

  const projectCandidate = path.resolve(projectRoot, candidatePath);
  if (fs.existsSync(projectCandidate)) {
    return projectCandidate;
  }

  return path.resolve(drupalRoot, candidatePath);
}

function hasComposerPackage(projectRoot: string, packageName: string): boolean {
  const composerJson = readJsonFile<Record<string, unknown>>(path.join(projectRoot, "composer.json"));
  const composerLock = readJsonFile<Record<string, unknown>>(path.join(projectRoot, "composer.lock"));

  const requireMap = composerJson?.require;
  if (
    requireMap &&
    typeof requireMap === "object" &&
    packageName in (requireMap as Record<string, unknown>)
  ) {
    return true;
  }

  const packages = [
    ...(Array.isArray(composerLock?.packages) ? composerLock.packages : []),
    ...(Array.isArray(composerLock?.["packages-dev"]) ? composerLock["packages-dev"] : []),
  ];

  return packages.some((pkg) => pkg?.name === packageName);
}

function detectEnvironmentIndicators(
  projectRoot: string,
  drupalRoot: string,
  hasConfigSplit: boolean,
): string[] {
  const indicators = new Set<string>();

  const settingsLocalPath = path.join(drupalRoot, "sites", "default", "settings.local.php");
  if (pathIsFile(settingsLocalPath)) {
    indicators.add("sites/default/settings.local.php");
  }

  for (const envFile of [".env", ".env.local", ".env.dev", ".env.prod"]) {
    if (pathIsFile(path.join(projectRoot, envFile))) {
      indicators.add(envFile);
    }
  }

  const drushSitesPath = path.join(projectRoot, "drush", "sites");
  if (pathIsDirectory(drushSitesPath)) {
    indicators.add("drush/sites");
  }

  if (hasConfigSplit) {
    indicators.add("drupal/config_split");
  }

  return Array.from(indicators).sort();
}

function findFilesystemConfigSyncDirectory(
  projectRoot: string,
  drupalRoot: string,
): string | null {
  const directCandidates = [
    path.join(projectRoot, "config", "sync"),
    path.resolve(drupalRoot, "../config/sync"),
  ];

  for (const candidate of directCandidates) {
    if (pathIsDirectory(candidate)) {
      return toProjectRelativePath(projectRoot, candidate).replace(/\\/g, "/");
    }
  }

  const siteFilesDir = path.join(drupalRoot, "sites", "default", "files");
  if (!pathIsDirectory(siteFilesDir)) {
    return null;
  }

  const configDirectories = fs
    .readdirSync(siteFilesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("config_"))
    .map((entry) => path.join(siteFilesDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (configDirectories.length === 0) {
    return null;
  }

  return toProjectRelativePath(projectRoot, configDirectories[0]).replace(/\\/g, "/");
}

export function detectConfigLayout(
  config: ServerConfig,
  options: ConfigLayoutOptions = {},
): ConfigLayoutDetection {
  const projectRoot = resolveProjectRoot(config);
  const hasConfigSplit = hasComposerPackage(projectRoot, "drupal/config_split");
  const environmentIndicators = detectEnvironmentIndicators(
    projectRoot,
    config.drupalRoot,
    hasConfigSplit,
  );

  const rawSyncDirectory = options.drushStatus?.details["config-sync"];
  if (typeof rawSyncDirectory === "string" && rawSyncDirectory.trim().length > 0) {
    return {
      syncDirectory: normaliseProjectPath(projectRoot, config.drupalRoot, rawSyncDirectory),
      hasConfigSplit,
      environmentIndicators,
      detectionMethod: "drush",
      configSyncDetected: true,
      configLayoutUncertain: false,
    };
  }

  const filesystemSyncDirectory = findFilesystemConfigSyncDirectory(projectRoot, config.drupalRoot);
  if (filesystemSyncDirectory) {
    return {
      syncDirectory: filesystemSyncDirectory,
      hasConfigSplit,
      environmentIndicators,
      detectionMethod: "filesystem",
      configSyncDetected: true,
      configLayoutUncertain: false,
    };
  }

  const settingsPhpPath = path.join(config.drupalRoot, "sites", "default", "settings.php");

  return {
    syncDirectory: null,
    hasConfigSplit,
    environmentIndicators,
    detectionMethod: "none",
    configSyncDetected: false,
    configLayoutUncertain: pathIsFile(settingsPhpPath),
  };
}

export function deriveProjectCapabilities(facts: {
  drupalRootValid: boolean;
  composerJsonPresent: boolean;
  drushAvailable: boolean;
  composerAvailable: boolean;
  configLayout: ConfigLayoutDetection;
}): ProjectCapabilities {
  const canReadProjectManifest = facts.drupalRootValid;
  const canRunDrush = facts.drupalRootValid && facts.drushAvailable;
  const canRunComposer = facts.composerAvailable && facts.composerJsonPresent;
  const canAssessConfig =
    facts.drupalRootValid &&
    (facts.configLayout.configSyncDetected ||
      facts.configLayout.configLayoutUncertain ||
      canRunDrush);

  return {
    can_read_project_manifest: canReadProjectManifest,
    can_inspect_modules: canRunDrush,
    can_run_drush: canRunDrush,
    can_run_composer: canRunComposer,
    can_assess_config: canAssessConfig,
  };
}

export function collectProjectFacts(
  config: ServerConfig,
  binaryValidation: BinaryValidationResult,
  options: ConfigLayoutOptions = {},
): ProjectFacts {
  const projectRoot = resolveProjectRoot(config);
  const drupalRootValid = pathIsDirectory(config.drupalRoot);
  const composerJsonPresent = pathIsFile(path.join(projectRoot, "composer.json"));
  const configLayout = detectConfigLayout(config, options);
  const drushAvailable = binaryValidation.drush.exists;
  const composerAvailable = binaryValidation.composer.exists;

  return {
    projectRoot,
    drupalRootValid,
    composerJsonPresent,
    drushAvailable,
    composerAvailable,
    configLayout,
    capabilities: deriveProjectCapabilities({
      drupalRootValid,
      composerJsonPresent,
      drushAvailable,
      composerAvailable,
      configLayout,
    }),
  };
}

export function discoverProjectItems(
  projectRoot: string,
  relativeDirs: string[] | undefined,
): ProjectItem[] {
  if (!relativeDirs || relativeDirs.length === 0) {
    return [];
  }

  const results: ProjectItem[] = [];

  for (const relativeDir of relativeDirs) {
    const baseDir = path.resolve(projectRoot, relativeDir);
    if (!pathIsDirectory(baseDir)) {
      continue;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const fullPath = path.join(baseDir, entry.name);
      results.push({
        name: entry.name,
        path: toProjectRelativePath(projectRoot, fullPath).replace(/\\/g, "/"),
      });
    }
  }

  return results;
}
