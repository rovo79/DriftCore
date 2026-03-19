import type { ErrorDetail, ResourceOrToolResponse, ServerConfig, ServerState } from "../types.js";
import type { ModuleDescriptor, ThemeDescriptor } from "./drushTools.js";
import { runDrushPml } from "./drushTools.js";
import { discoverProjectItems } from "./projectTruth.js";
import { resolveProjectRoot } from "./projectPaths.js";

export interface ProjectModuleDescriptor {
  name: string;
  path?: string;
  type: ModuleDescriptor["type"];
  status: ModuleDescriptor["status"] | "unknown";
}

export type ProjectThemeDescriptor = ProjectModuleDescriptor;

export interface ProjectModulesData {
  modules: ProjectModuleDescriptor[];
  themes: ProjectThemeDescriptor[];
  summary: {
    total: number;
    enabled: number;
    custom: number;
  };
}

export type ProjectModulesResponse = ResourceOrToolResponse<ProjectModulesData>;

interface ProjectModulesDependencies {
  runPml?: typeof runDrushPml;
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

function summariseExtensions(
  modules: ProjectModuleDescriptor[],
  themes: ProjectThemeDescriptor[],
): ProjectModulesData["summary"] {
  const allExtensions = [...modules, ...themes];

  return {
    total: allExtensions.length,
    enabled: allExtensions.filter((extension) => extension.status === "enabled").length,
    custom: allExtensions.filter((extension) => extension.type === "custom").length,
  };
}

function buildFallbackData(config: ServerConfig): ProjectModulesData {
  const projectRoot = resolveProjectRoot(config);
  const customModules = discoverProjectItems(projectRoot, config.customModuleDirs).map((item) => ({
    ...item,
    type: "custom" as const,
    status: "unknown" as const,
  }));
  const customThemes = discoverProjectItems(projectRoot, config.customThemeDirs).map((item) => ({
    ...item,
    type: "custom" as const,
    status: "unknown" as const,
  }));

  return {
    modules: customModules,
    themes: customThemes,
    summary: summariseExtensions(customModules, customThemes),
  };
}

function toProjectModulesData(
  modules: ModuleDescriptor[],
  themes: ThemeDescriptor[],
): ProjectModulesData {
  return {
    modules,
    themes,
    summary: summariseExtensions(modules, themes),
  };
}

function toFallbackError(error?: ErrorDetail): ErrorDetail {
  if (error) {
    return error;
  }

  return {
    code: "E_DRUSH_UNAVAILABLE",
    message: "Drush module discovery is unavailable; returning filesystem-only custom extensions.",
  };
}

export async function getProjectModules(
  state: ServerState,
  dependencies: ProjectModulesDependencies = {},
): Promise<ProjectModulesResponse> {
  const ensured = ensureConfig<ProjectModulesData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }

  const drushResponse = await (dependencies.runPml ?? runDrushPml)(state);
  if (drushResponse.status === "ok" && drushResponse.data) {
    return {
      status: "ok",
      data: toProjectModulesData(drushResponse.data.modules, drushResponse.data.themes),
    };
  }

  return {
    status: "degraded",
    data: buildFallbackData(ensured.config),
    error: toFallbackError(drushResponse.error),
  };
}
