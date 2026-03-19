import fs from "node:fs";
import path from "node:path";
import type { ResourceOrToolResponse, ServerConfig, ServerState } from "../../types.js";
import { getProjectManifest } from "../projectManifest.js";
import { resolveProjectRoot } from "../projectPaths.js";

export interface ScaffoldPlanFile {
  path: string;
  description: string;
  template_hint: string;
}

export interface ScaffoldPlanData {
  target_type: "module" | "theme";
  machine_name: string;
  target_directory: string;
  files: ScaffoldPlanFile[];
  conventions_detected: string[];
  drupal_core_version: string | null;
  summary: string;
}

export interface ScaffoldPlanInput {
  machine_name: string;
  target_type: "module" | "theme";
}

export type ScaffoldPlanResponse = ResourceOrToolResponse<ScaffoldPlanData>;

interface ScaffoldPlanningDependencies {
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

function normaliseProjectPath(projectRoot: string, targetPath: string): string {
  return path.relative(projectRoot, targetPath).replace(/\\/g, "/");
}

function machineNameToClassBase(machineName: string): string {
  return machineName
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function inspectItemConventions(itemPath: string, targetType: "module" | "theme"): string[] {
  const conventions = new Set<string>();

  const fileExists = (relativePath: string): boolean => fs.existsSync(path.join(itemPath, relativePath));
  const dirExists = (relativePath: string): boolean => {
    try {
      return fs.statSync(path.join(itemPath, relativePath)).isDirectory();
    } catch {
      return false;
    }
  };

  if (fileExists(`${path.basename(itemPath)}.info.yml`)) {
    conventions.add(`${targetType}-info-file`);
  }

  if (targetType === "module") {
    if (fileExists(`${path.basename(itemPath)}.module`)) {
      conventions.add("module-hook-file");
    }
    if (fileExists(`${path.basename(itemPath)}.routing.yml`)) {
      conventions.add("module-routing");
    }
    if (fileExists(`${path.basename(itemPath)}.services.yml`)) {
      conventions.add("module-services");
    }
    if (dirExists("src")) {
      conventions.add("module-src-tree");
    }
    if (dirExists("templates")) {
      conventions.add("module-templates");
    }
  } else {
    if (fileExists(`${path.basename(itemPath)}.libraries.yml`)) {
      conventions.add("theme-libraries-file");
    }
    if (dirExists("templates")) {
      conventions.add("theme-templates-tree");
    }
    if (dirExists("css")) {
      conventions.add("theme-css-tree");
    }
    if (dirExists("js")) {
      conventions.add("theme-js-tree");
    }
  }

  return Array.from(conventions);
}

function detectConventions(
  projectRoot: string,
  items: Array<{ name: string; path: string }>,
  targetType: "module" | "theme",
): string[] {
  const conventions = new Set<string>();

  for (const item of items) {
    const absolutePath = path.resolve(projectRoot, item.path);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    for (const convention of inspectItemConventions(absolutePath, targetType)) {
      conventions.add(convention);
    }
  }

  if (conventions.size === 0) {
    conventions.add(`default-${targetType}-layout`);
  }

  return Array.from(conventions).sort();
}

function resolveTargetDirectory(
  config: ServerConfig,
  targetType: "module" | "theme",
  machineName: string,
): string {
  const projectRoot = resolveProjectRoot(config);
  const configuredDir =
    targetType === "module"
      ? config.customModuleDirs?.[0]
      : config.customThemeDirs?.[0];
  const defaultDir =
    targetType === "module" ? "web/modules/custom" : "web/themes/custom";
  const baseDir = configuredDir && configuredDir.length > 0 ? configuredDir : defaultDir;
  const absolutePath = path.resolve(projectRoot, baseDir, machineName);
  return normaliseProjectPath(projectRoot, absolutePath);
}

function buildModuleFiles(
  machineName: string,
  classBase: string,
  conventions: string[],
  coreVersion: string | null,
): ScaffoldPlanFile[] {
  const files: ScaffoldPlanFile[] = [
    {
      path: `${machineName}.info.yml`,
      description: "Declare the module, its dependencies, and Drupal core compatibility.",
      template_hint: `Use core_version_requirement: ${coreVersion ? `^${coreVersion.split(".")[0]}` : "^10 || ^11"} and add the module description, package, and dependencies.`,
    },
    {
      path: `${machineName}.module`,
      description: "Add procedural hook implementations if the module needs them.",
      template_hint: "Start with an empty hook file unless the module needs Drupal hooks or preprocess functions.",
    },
  ];

  if (conventions.includes("module-routing") || conventions.includes("module-src-tree")) {
    files.push({
      path: `${machineName}.routing.yml`,
      description: "Define routes for controller or form pages.",
      template_hint: "Use route names and controller class references that match the module namespace.",
    });
    files.push({
      path: `src/Controller/${classBase}Controller.php`,
      description: "Provide a controller class for routed pages or AJAX callbacks.",
      template_hint: `Namespace the class as Drupal\\${machineName}\\Controller\\${classBase}Controller and follow the Drupal ${coreVersion ? coreVersion.split(".")[0] : "11"} controller style.`,
    });
  }

  if (conventions.includes("module-services") || conventions.includes("module-src-tree")) {
    files.push({
      path: `${machineName}.services.yml`,
      description: "Register dependency injection services for reusable business logic.",
      template_hint: "Use this when the module has services, event subscribers, or other container-managed classes.",
    });
  }

  if (conventions.includes("module-templates")) {
    files.push({
      path: `templates/${machineName}.html.twig`,
      description: "Add a Twig template if the module renders themeable output.",
      template_hint: "Render variables from preprocess hooks or controller render arrays.",
    });
  }

  return files;
}

function buildThemeFiles(
  machineName: string,
  conventions: string[],
  coreVersion: string | null,
): ScaffoldPlanFile[] {
  const files: ScaffoldPlanFile[] = [
    {
      path: `${machineName}.info.yml`,
      description: "Declare the theme, its base theme, and core compatibility.",
      template_hint: `Set core_version_requirement to ${coreVersion ? `^${coreVersion.split(".")[0]}` : "^10 || ^11"} and add the theme name, base theme, and regions.`,
    },
    {
      path: `${machineName}.libraries.yml`,
      description: "Define CSS and JavaScript assets for the theme.",
      template_hint: "Attach assets from Twig templates or preprocess hooks.",
    },
  ];

  if (conventions.includes("theme-templates-tree")) {
    files.push({
      path: "templates/page.html.twig",
      description: "Add a Twig template for page-level markup overrides.",
      template_hint: "Use this as the starting point for block regions and layout markup.",
    });
  }

  if (conventions.includes("theme-css-tree")) {
    files.push({
      path: "css/style.css",
      description: "Add theme stylesheets here.",
      template_hint: "Keep theme-specific styles isolated and attach them through the library file.",
    });
  }

  if (conventions.includes("theme-js-tree")) {
    files.push({
      path: "js/script.js",
      description: "Add theme JavaScript behavior here.",
      template_hint: "Use Drupal behaviors and attach this file from the theme library.",
    });
  }

  return files;
}

function buildSummary(
  targetType: "module" | "theme",
  machineName: string,
  targetDirectory: string,
  conventions: string[],
  files: ScaffoldPlanFile[],
  coreVersion: string | null,
): string {
  const coreLabel = coreVersion ? `Drupal ${coreVersion.split(".")[0]}` : "an unknown Drupal core version";
  return `Prepared a ${targetType} scaffold plan for ${machineName} under ${targetDirectory} using ${conventions.join(", ")} conventions on ${coreLabel}. The plan starts with ${files.length} file${files.length === 1 ? "" : "s"}.`;
}

function validateScaffoldPlanInput(
  input: unknown,
): { ok: true; value: ScaffoldPlanInput } | { ok: false; response: ResourceOrToolResponse<never> } {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      response: {
        status: "error",
        error: {
          code: "E_INVALID_INPUT",
          message: "Scaffold planning requires machine_name and target_type inputs.",
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

  if (targetType !== "module" && targetType !== "theme") {
    return {
      ok: false,
      response: {
        status: "error",
        error: {
          code: "E_INVALID_INPUT",
          message: 'target_type must be either "module" or "theme".',
        },
      },
    };
  }

  return {
    ok: true,
    value: {
      machine_name: machineName,
      target_type: targetType,
    },
  };
}

export function parseScaffoldPlanInput(
  input: unknown,
): { ok: true; value: ScaffoldPlanInput } | { ok: false; response: ResourceOrToolResponse<never> } {
  return validateScaffoldPlanInput(input);
}

export async function runScaffoldPlanning(
  state: ServerState,
  input: ScaffoldPlanInput,
  dependencies: ScaffoldPlanningDependencies = {},
): Promise<ScaffoldPlanResponse> {
  const ensured = ensureConfig<ScaffoldPlanData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }

  const getManifest = dependencies.getManifest ?? getProjectManifest;
  const manifestResponse = await getManifest(state);
  const manifestData = manifestResponse.data;
  const projectRoot = resolveProjectRoot(ensured.config);
  const items =
    input.target_type === "module"
      ? manifestData?.custom_modules ?? []
      : manifestData?.custom_themes ?? [];
  const conventions = detectConventions(projectRoot, items, input.target_type);
  const coreVersion = manifestData?.drupal_core_version ?? null;
  const targetDirectory = resolveTargetDirectory(ensured.config, input.target_type, input.machine_name);
  const classBase = machineNameToClassBase(input.machine_name);
  const files =
    input.target_type === "module"
      ? buildModuleFiles(input.machine_name, classBase, conventions, coreVersion)
      : buildThemeFiles(input.machine_name, conventions, coreVersion);

  const data: ScaffoldPlanData = {
    target_type: input.target_type,
    machine_name: input.machine_name,
    target_directory: targetDirectory,
    files,
    conventions_detected: conventions,
    drupal_core_version: coreVersion,
    summary: buildSummary(input.target_type, input.machine_name, targetDirectory, conventions, files, coreVersion),
  };

  if (manifestResponse.status === "ok") {
    return {
      status: "ok",
      data,
    };
  }

  return {
    status: "degraded",
    data,
    error:
      manifestResponse.error ??
      {
        code: "E_SCAFFOLD_PLAN_PARTIAL",
        message: "Scaffold planning could not read the full project manifest.",
      },
  };
}
