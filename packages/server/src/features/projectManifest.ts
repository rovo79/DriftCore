import type {
  ErrorDetail,
  ResourceOrToolResponse,
  ServerConfig,
  ServerState,
} from "../types.js";
import { resolveProjectRoot, readJsonFile, toProjectRelativePath } from "./projectPaths.js";
import path from "node:path";
import fs from "node:fs";

interface ComposerError {
  code: string;
  message: string;
}

interface ComposerSummary {
  status: "ok" | "partial" | "missing";
  name?: string;
  require?: Record<string, string>;
  errors?: ComposerError[];
}

interface CustomModule {
  name: string;
  path: string;
}

interface CustomTheme {
  name: string;
  path: string;
}

export interface ProjectManifestData {
  schema_version: "0.1.0";
  drupal_root: string;
  drupal_core_version: string | null;
  project_type: string | null;
  composer: ComposerSummary;
  custom_modules: CustomModule[];
  custom_themes: CustomTheme[];
}

export type ProjectManifestResponse = ResourceOrToolResponse<ProjectManifestData>;

function extractDrupalCoreVersion(lockJson: any): string | null {
  if (!lockJson) {
    return null;
  }

  const packages: any[] = Array.isArray(lockJson.packages) ? lockJson.packages : [];
  const packagesDev: any[] = Array.isArray(lockJson["packages-dev"])
    ? lockJson["packages-dev"]
    : [];
  const allPackages = [...packages, ...packagesDev];

  const corePackage =
    allPackages.find((pkg) => pkg.name === "drupal/core-recommended") ??
    allPackages.find((pkg) => pkg.name === "drupal/core");

  return typeof corePackage?.version === "string" ? corePackage.version : null;
}

function deriveProjectType(composerJson: any | null): string | null {
  if (!composerJson || typeof composerJson !== "object") {
    return null;
  }

  const require = composerJson.require ?? {};
  if (require && typeof require === "object" && "drupal/core-recommended" in require) {
    return "drupal-recommended-project";
  }

  if (typeof composerJson.type === "string" && composerJson.type.length > 0) {
    return composerJson.type;
  }

  return null;
}

function summariseComposer(
  projectRoot: string,
): { summary: ComposerSummary; coreVersion: string | null } {
  const composerPath = path.join(projectRoot, "composer.json");
  const lockPath = path.join(projectRoot, "composer.lock");
  const errors: ComposerError[] = [];

  const composerJson = readJsonFile<any>(composerPath);
  if (!composerJson) {
    return {
      summary: {
        status: "missing",
        errors: [
          {
            code: "E_MANIFEST_INCOMPLETE",
            message: `composer.json not found or unreadable at ${composerPath}`,
          },
        ],
      },
      coreVersion: null,
    };
  }

  const summary: ComposerSummary = {
    status: "ok",
  };

  if (typeof composerJson.name === "string") {
    summary.name = composerJson.name;
  }
  if (composerJson.require && typeof composerJson.require === "object") {
    summary.require = composerJson.require as Record<string, string>;
  }

  const lockJson = readJsonFile<any>(lockPath);
  const coreVersion = extractDrupalCoreVersion(lockJson);

  if (!lockJson) {
    errors.push({
      code: "E_MANIFEST_INCOMPLETE",
      message: `composer.lock not found or unreadable at ${lockPath}`,
    });
  }

  if (errors.length > 0) {
    summary.status = summary.name || summary.require ? "partial" : "missing";
    summary.errors = errors;
  }

  return { summary, coreVersion };
}

function discoverCustomItems(
  projectRoot: string,
  relativeDirs: string[] | undefined,
): CustomModule[] {
  if (!relativeDirs || relativeDirs.length === 0) {
    return [];
  }

  const results: CustomModule[] = [];

  for (const rel of relativeDirs) {
    const baseDir = path.resolve(projectRoot, rel);
    if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
      continue;
    }
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(baseDir, entry.name);
      const projectRelative = toProjectRelativePath(projectRoot, fullPath);
      results.push({
        name: entry.name,
        path: projectRelative,
      });
    }
  }

  return results;
}

async function buildManifest(config: ServerConfig): Promise<ProjectManifestResponse> {
  const projectRoot = resolveProjectRoot(config);
  const { summary: composerSummary, coreVersion } = summariseComposer(projectRoot);

  const customModules = discoverCustomItems(projectRoot, config.customModuleDirs);
  const customThemes = discoverCustomItems(projectRoot, config.customThemeDirs);

  const manifest: ProjectManifestData = {
    schema_version: "0.1.0",
    drupal_root: config.drupalRoot,
    drupal_core_version: coreVersion,
    project_type: deriveProjectType(
      readJsonFile<any>(path.join(projectRoot, "composer.json")),
    ),
    composer: composerSummary,
    custom_modules: customModules,
    custom_themes: customThemes,
  };

  if (composerSummary.status === "ok") {
    return {
      status: "ok",
      data: manifest,
    };
  }

  const error: ErrorDetail = {
    code: "E_MANIFEST_INCOMPLETE",
    message: "Composer metadata could not be fully read for this project",
    diagnostics: {
      composerStatus: composerSummary.status,
      composerErrors: composerSummary.errors,
    },
  };

  return {
    status: "degraded",
    data: manifest,
    error,
  };
}

export async function getProjectManifest(
  state: ServerState,
): Promise<ProjectManifestResponse> {
  if (!state.config) {
    return {
      status: "not_configured",
      error:
        state.configError ??
        ({
          code: "E_CONFIG_INVALID_ROOT",
          message: "DriftCore configuration is missing or invalid",
        } as ErrorDetail),
    };
  }

  return buildManifest(state.config as ServerConfig);
}
