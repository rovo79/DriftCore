import fs from "node:fs";
import path from "node:path";
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
import { resolveProjectRoot, toProjectRelativePath } from "./projectPaths.js";
import { createTimedCache } from "./cache.js";
import { mapCliResultToError, truncateStderr } from "./errorMapping.js";

type CliRunner = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

export interface DrushStatusData {
  drupal_version: string | null;
  php_version: string | null;
  database_driver: string | null;
  site_path: string | null;
  details: Record<string, string>;
}

export interface ModuleDescriptor {
  name: string;
  type: "core" | "contrib" | "custom" | "unknown";
  status: "enabled" | "disabled";
}

export type ThemeDescriptor = ModuleDescriptor;

export interface DrushPmlData {
  modules: ModuleDescriptor[];
  themes: ThemeDescriptor[];
}

const pmlCache = createTimedCache<ResourceOrToolResponse<DrushPmlData>>();

export function getDrushTools(): MCPTool[] {
  return [
    {
      name: "drift.drush_status",
      description:
        "Runs `drush status --format=json` from the configured Drupal root and returns normalized status metadata.",
      command: "drush status",
      args: ["--format=json"],
      examples: ["drush status --format=json"],
    },
    {
      name: "drift.drush_pml",
      description:
        "Runs `drush pm:list --format=json` to list all modules and themes with status/type metadata.",
      command: "drush pm:list",
      args: ["--format=json"],
      examples: ["drush pm:list --format=json"],
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

function resolveDrushCommand(config: ServerConfig): string {
  if (config.drushPath) {
    return config.drushPath;
  }
  const projectRoot = resolveProjectRoot(config);
  const vendorDrush = path.join(projectRoot, "vendor", "bin", "drush");
  if (pathExists(vendorDrush)) {
    return vendorDrush;
  }
  return "drush";
}

function pathExists(target: string): boolean {
  return fs.existsSync(target);
}

function coerceString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function parseJsonOutput<T>(raw: string): T {
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Drush output did not contain JSON data");
  }
  const trimmed = raw.slice(firstBrace).trim();
  return JSON.parse(trimmed) as T;
}

export async function runDrushStatus(
  state: ServerState,
  runner: CliRunner = runCliCommand,
): Promise<ResourceOrToolResponse<DrushStatusData>> {
  const ensured = ensureConfig<DrushStatusData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }
  const { config } = ensured;
  const command = resolveDrushCommand(config);
  const args = ["status", "--format=json"];
  const cliResult = await runner({
    command,
    args,
    cwd: config.drupalRoot,
    timeoutMs: config.timeouts?.drushStatusMs ?? 10000,
    maxParallel: config.maxParallelCli ?? 1,
  });

  if (cliResult.timedOut || cliResult.exitCode !== 0) {
    return mapCliResultToError<DrushStatusData>(cliResult, {
      command,
      args,
      cwd: config.drupalRoot,
    }, {
      missingBinaryCode: "E_DRUSH_NOT_FOUND",
      missingBinaryMessage:
        "Drush executable was not found. Install Drush or update the configuration.",
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonOutput<Record<string, unknown>>(cliResult.stdout);
  } catch (error) {
    return {
      status: "error",
      error: {
        code: "E_JSON_PARSE",
        message: "Failed to parse Drush status output as JSON",
        diagnostics: {
          command,
          args,
        },
        details: { error: (error as Error).message },
        stderr: truncateStderr(cliResult.stderr),
      },
    };
  }

  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) {
      details[key] = "";
    } else if (typeof value === "object") {
      details[key] = JSON.stringify(value);
    } else {
      details[key] = String(value);
    }
  }

  return {
    status: "ok",
    data: {
      drupal_version: coerceString(parsed["drupal-version"]),
      php_version: coerceString(parsed["php-version"]),
      database_driver: coerceString(parsed["db-driver"]),
      site_path: coerceString(parsed["site"]),
      details,
    },
  };
}

export async function runDrushPml(
  state: ServerState,
  runner: CliRunner = runCliCommand,
): Promise<ResourceOrToolResponse<DrushPmlData>> {
  const ensured = ensureConfig<DrushPmlData>(state);
  if (!("config" in ensured)) {
    return ensured;
  }
  const { config } = ensured;
  const ttlMs = config.cacheTtlMs?.pml ?? 5000;

  return pmlCache.get(ttlMs, async () => {
    const command = resolveDrushCommand(config);
    const args = ["pm:list", "--format=json"];
    const cliResult = await runner({
      command,
      args,
      cwd: config.drupalRoot,
      timeoutMs: config.timeouts?.drushPmlMs ?? 15000,
      maxParallel: config.maxParallelCli ?? 1,
    });

    if (cliResult.timedOut || cliResult.exitCode !== 0) {
      return mapCliResultToError<DrushPmlData>(cliResult, {
        command,
        args,
        cwd: config.drupalRoot,
      }, {
        missingBinaryCode: "E_DRUSH_NOT_FOUND",
        missingBinaryMessage:
          "Drush executable was not found. Install Drush or update the configuration.",
      });
    }

    let parsed: unknown;
    try {
      parsed = parseJsonOutput<unknown>(cliResult.stdout);
    } catch (error) {
      return {
        status: "error",
        error: {
          code: "E_JSON_PARSE",
          message: "Failed to parse Drush pm:list output as JSON",
          diagnostics: {
            command,
            args,
          },
          details: { error: (error as Error).message },
          stderr: truncateStderr(cliResult.stderr),
        },
      };
    }

    const data = normalisePmlOutput(parsed, config);
    return {
      status: "ok",
      data,
    };
  });
}

function normalisePmlOutput(raw: unknown, config: ServerConfig): DrushPmlData {
  const modules = normaliseExtensions(raw, "modules", config, "module");
  const themes = normaliseExtensions(raw, "themes", config, "theme") as ThemeDescriptor[];
  return { modules, themes };
}

type ExtensionKind = "module" | "theme";

function normaliseExtensions(
  raw: unknown,
  sectionKey: string,
  config: ServerConfig,
  kind: ExtensionKind,
): ModuleDescriptor[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const container =
    (raw as Record<string, unknown>)[sectionKey] ?? raw;

  const items: Array<{ name: string; info: any }> = [];

  if (Array.isArray(container)) {
    for (const entry of container) {
      if (entry && typeof entry === "object") {
        const name =
          typeof (entry as any).name === "string"
            ? (entry as any).name
            : typeof (entry as any).machine_name === "string"
              ? (entry as any).machine_name
              : "";
        items.push({ name, info: entry });
      }
    }
  } else if (container && typeof container === "object") {
    for (const [name, value] of Object.entries(container)) {
      items.push({ name, info: value });
    }
  }

  return items.map(({ name, info }) => {
    const rawStatus =
      typeof info === "object" && info
        ? (info as any).status ?? (info as any).state ?? ""
        : "";
    const normalizedStatus =
      typeof rawStatus === "string" && rawStatus.toLowerCase().includes("enable")
        ? "enabled"
        : "disabled";

    const resolvedInfo = info as Record<string, unknown>;
    const fallbackName =
      typeof resolvedInfo?.name === "string"
        ? (resolvedInfo.name as string)
        : typeof resolvedInfo?.machine_name === "string"
          ? (resolvedInfo.machine_name as string)
          : "unknown";

    const descriptor: ModuleDescriptor = {
      name: name || fallbackName,
      type: classifyExtension(resolvedInfo, config, kind),
      status: normalizedStatus as "enabled" | "disabled",
    };
    return descriptor;
  });
}

function classifyExtension(
  info: unknown,
  config: ServerConfig,
  kind: ExtensionKind,
): "core" | "contrib" | "custom" | "unknown" {
  if (!info || typeof info !== "object") {
    return "unknown";
  }

  const packageName = String((info as any).package ?? "").toLowerCase();
  if (packageName.includes("core")) {
    return "core";
  }
  if (packageName.includes("contrib")) {
    return "contrib";
  }
  if (packageName.includes("custom")) {
    return "custom";
  }

  const extensionPath = (info as any).path ?? (info as any).extensionPath;
  if (typeof extensionPath === "string") {
    const projectRoot = resolveProjectRoot(config);
    const relativePath = toProjectRelativePath(projectRoot, extensionPath).replace(
      /\\/g,
      "/",
    );
    const dirs =
      kind === "module"
        ? config.customModuleDirs ?? []
        : config.customThemeDirs ?? [];
    if (dirs.some((dir) => relativePath.startsWith(dir.replace(/\\/g, "/")))) {
      return "custom";
    }
    if (relativePath.startsWith("core/")) {
      return "core";
    }
    if (relativePath.includes("/contrib/")) {
      return "contrib";
    }
  }

  return "unknown";
}
