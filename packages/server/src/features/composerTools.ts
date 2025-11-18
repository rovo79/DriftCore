import path from "node:path";
import fs from "node:fs";
import type {
  MCPTool,
  ResourceOrToolResponse,
  ServerConfig,
  ServerState,
} from "../types.js";
import {
  runCliCommand,
  type CliExecutionOptions,
  type CliExecutionResult,
} from "./sandboxExecution.js";
import { resolveProjectRoot, readJsonFile } from "./projectPaths.js";
import { mapCliResultToError, truncateStderr } from "./errorMapping.js";

type CliRunner = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

export interface ComposerInfoData {
  manifest: {
    name?: string;
    require?: Record<string, string>;
  };
  lock_summary?: {
    packages?: Array<{ name: string; version: string }>;
  };
}

export interface ComposerOutdatedPackage {
  name: string;
  current_version: string;
  constraint?: string;
  latest_version: string | null;
  latest_status: "semver-safe-update" | "update-possible" | "unknown";
  package_type?: "drupal-core" | "drupal-module" | "drupal-theme" | "library";
}

export interface ComposerOutdatedData {
  packages: ComposerOutdatedPackage[];
}

export function getComposerTools(): MCPTool[] {
  return [
    {
      name: "drift.composer_info",
      description: "Reads composer.json/lock and returns manifest + lock summaries.",
      command: "composer info",
      args: [],
      examples: [],
    },
    {
      name: "drift.composer_outdated",
      description:
        "Runs `composer outdated --format=json` and normalizes package update metadata.",
      command: "composer outdated",
      args: ["--format=json"],
      examples: ["composer outdated --format=json"],
    },
  ];
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

export async function runComposerInfo(
  state: ServerState,
): Promise<ResourceOrToolResponse<ComposerInfoData>> {
  const ensured = ensureConfig<ComposerInfoData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }
  const { config } = ensured;
  const projectRoot = resolveProjectRoot(config);
  const composerPath = path.join(projectRoot, "composer.json");
  const lockPath = path.join(projectRoot, "composer.lock");

  const composerJson = readJsonFile<Record<string, any>>(composerPath);
  if (!composerJson) {
    return {
      status: "error",
      error: {
        code: "E_COMPOSER_NOT_FOUND",
        message: `composer.json not found at ${composerPath}`,
      },
    };
  }

  const manifest: ComposerInfoData["manifest"] = {};
  if (typeof composerJson.name === "string") {
    manifest.name = composerJson.name;
  }
  if (composerJson.require && typeof composerJson.require === "object") {
    manifest.require = composerJson.require as Record<string, string>;
  }

  const lockJson = readJsonFile<Record<string, any>>(lockPath);
  const packages: Array<{ name: string; version: string }> | undefined = lockJson
    ? extractLockPackages(lockJson)
    : undefined;

  const data: ComposerInfoData = {
    manifest,
  };

  if (packages && packages.length > 0) {
    data.lock_summary = {
      packages,
    };
  }

  return {
    status: "ok",
    data,
  };
}

function extractLockPackages(lockJson: Record<string, any>) {
  const sections = [
    ...(Array.isArray(lockJson.packages) ? lockJson.packages : []),
    ...(Array.isArray(lockJson["packages-dev"]) ? lockJson["packages-dev"] : []),
  ];
  return sections.map((pkg) => ({
    name: pkg.name as string,
    version: pkg.version as string,
  }));
}

export async function runComposerOutdated(
  state: ServerState,
  runner: CliRunner = runCliCommand,
): Promise<ResourceOrToolResponse<ComposerOutdatedData>> {
  const ensured = ensureConfig<ComposerOutdatedData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }
  const { config } = ensured;
  const projectRoot = resolveProjectRoot(config);
  const manifest = readJsonFile<Record<string, any>>(path.join(projectRoot, "composer.json"));
  const lockJson = readJsonFile<Record<string, any>>(path.join(projectRoot, "composer.lock"));

  const command = resolveComposerCommand(config, projectRoot);
  const args = ["outdated", "--format=json"];
  const cliResult = await runner({
    command,
    args,
    cwd: projectRoot,
    timeoutMs: config.timeouts?.composerOutdatedMs ?? 30000,
    env: {
      COMPOSER_DISABLE_XDEBUG_WARN: "1",
      COMPOSER_MEMORY_LIMIT: process.env.COMPOSER_MEMORY_LIMIT ?? "1G",
    },
    maxParallel: config.maxParallelCli ?? 1,
  });

  if (cliResult.timedOut || cliResult.exitCode !== 0) {
    return mapCliResultToError<ComposerOutdatedData>(cliResult, {
      command,
      args,
      cwd: projectRoot,
    }, {
      missingBinaryCode: "E_COMPOSER_NOT_FOUND",
      missingBinaryMessage:
        "Composer executable was not found. Install Composer or update the configuration.",
    });
  }

  let parsed: any;
  try {
    parsed = parseComposerJson(cliResult.stdout);
  } catch (error) {
    return {
      status: "error",
      error: {
        code: "E_JSON_PARSE",
        message: "Failed to parse composer outdated output",
        details: { error: (error as Error).message },
        stderr: truncateStderr(cliResult.stderr),
      },
    };
  }

  const requireMap: Record<string, string> =
    (manifest?.require as Record<string, string>) ?? {};
  const packageTypes = buildPackageTypeMap(lockJson);

  const packages: ComposerOutdatedPackage[] = Array.isArray(parsed?.installed)
    ? parsed.installed.map((pkg: any) => ({
        name: pkg.name,
        current_version: pkg.version,
        constraint: requireMap[pkg.name],
        latest_version: pkg.latest ?? null,
        latest_status: (pkg["latest-status"] as ComposerOutdatedPackage["latest_status"]) ?? "unknown",
        package_type: packageTypes[pkg.name],
      }))
    : [];

  return {
    status: "ok",
    data: {
      packages,
    },
  };
}

function resolveComposerCommand(config: ServerConfig, projectRoot: string): string {
  if (config.composerPath) {
    return config.composerPath;
  }
  const vendorComposer = path.join(projectRoot, "vendor", "bin", "composer");
  if (fs.existsSync(vendorComposer)) {
    return vendorComposer;
  }
  const composerPhar = path.join(projectRoot, "composer.phar");
  if (fs.existsSync(composerPhar)) {
    return composerPhar;
  }
  return "composer";
}

function parseComposerJson(raw: string): any {
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Composer output did not contain JSON");
  }
  const lastBrace = raw.lastIndexOf("}");
  const jsonString = raw.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
}

function buildPackageTypeMap(
  lockJson: Record<string, any> | null,
): Record<string, ComposerOutdatedPackage["package_type"]> {
  if (!lockJson) {
    return {};
  }
  const packages = [
    ...(Array.isArray(lockJson.packages) ? lockJson.packages : []),
    ...(Array.isArray(lockJson["packages-dev"]) ? lockJson["packages-dev"] : []),
  ];
  const map: Record<string, ComposerOutdatedPackage["package_type"]> = {};
  for (const pkg of packages) {
    const type = typeof pkg.type === "string" ? pkg.type : "";
    if (type === "drupal-core") {
      map[pkg.name as string] = "drupal-core";
    } else if (type === "drupal-module") {
      map[pkg.name as string] = "drupal-module";
    } else if (type === "drupal-theme") {
      map[pkg.name as string] = "drupal-theme";
    }
  }
  return map;
}
