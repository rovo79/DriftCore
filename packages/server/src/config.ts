import fs from "node:fs";
import path from "node:path";
import type { ErrorDetail, ServerConfig, TimeoutsConfig, CacheTtlConfig } from "./types.js";

export interface LoadConfigOptions {
  configPath?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

export interface LoadedConfig {
  config: ServerConfig | null;
  configPath: string | null;
  error?: ErrorDetail;
}

const DEFAULT_CUSTOM_MODULE_DIRS = ["web/modules/custom", "modules/custom"];
const DEFAULT_CUSTOM_THEME_DIRS = ["web/themes/custom", "themes/custom"];

const DEFAULT_TIMEOUTS: Required<TimeoutsConfig> = {
  drushStatusMs: 10000,
  drushPmlMs: 15000,
  composerInfoMs: 8000,
  composerOutdatedMs: 30000,
};

const DEFAULT_CACHE_TTL_MS: Required<CacheTtlConfig> = {
  projectManifest: 5000,
  pml: 5000,
};

function applyDefaults(raw: ServerConfig): ServerConfig {
  const customModuleDirs =
    Array.isArray(raw.customModuleDirs) && raw.customModuleDirs.length > 0
      ? raw.customModuleDirs
      : DEFAULT_CUSTOM_MODULE_DIRS;

  const customThemeDirs =
    Array.isArray(raw.customThemeDirs) && raw.customThemeDirs.length > 0
      ? raw.customThemeDirs
      : DEFAULT_CUSTOM_THEME_DIRS;

  const timeouts: TimeoutsConfig = {
    drushStatusMs: raw.timeouts?.drushStatusMs ?? DEFAULT_TIMEOUTS.drushStatusMs,
    drushPmlMs: raw.timeouts?.drushPmlMs ?? DEFAULT_TIMEOUTS.drushPmlMs,
    composerInfoMs: raw.timeouts?.composerInfoMs ?? DEFAULT_TIMEOUTS.composerInfoMs,
    composerOutdatedMs:
      raw.timeouts?.composerOutdatedMs ?? DEFAULT_TIMEOUTS.composerOutdatedMs,
  };

  const cacheTtlMs: CacheTtlConfig = {
    projectManifest:
      raw.cacheTtlMs?.projectManifest ?? DEFAULT_CACHE_TTL_MS.projectManifest,
    pml: raw.cacheTtlMs?.pml ?? DEFAULT_CACHE_TTL_MS.pml,
  };

  return {
    drupalRoot: raw.drupalRoot,
    drushPath: raw.drushPath,
    composerPath: raw.composerPath,
    customModuleDirs,
    customThemeDirs,
    timeouts,
    maxParallelCli: raw.maxParallelCli ?? 1,
    cacheTtlMs,
  };
}

function resolveConfigPath(explicitPath?: string): string | null {
  if (explicitPath) {
    return explicitPath;
  }
  if (process.env.DRIFTCORE_CONFIG) {
    return process.env.DRIFTCORE_CONFIG;
  }
  return path.resolve(process.cwd(), "driftcore.config.json");
}

export function loadServerConfig(options: LoadConfigOptions = {}): LoadedConfig {
  const logger = options.logger ?? console;
  const configPath = resolveConfigPath(options.configPath);

  if (!configPath) {
    return { config: null, configPath: null };
  }

  if (!fs.existsSync(configPath)) {
    logger.warn?.(`DriftCore config not found at ${configPath}`);
    return {
      config: null,
      configPath,
      error: {
        code: "E_CONFIG_NOT_FOUND",
        message: `Configuration file not found at ${configPath}`,
        diagnostics: { configPath },
      },
    };
  }

  let parsed: unknown;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    const err = error as Error;
    logger.error?.(`Failed to read DriftCore config from ${configPath}: ${err.message}`);
    return {
      config: null,
      configPath,
      error: {
        code: "E_JSON_PARSE",
        message: `Failed to parse configuration JSON at ${configPath}`,
        diagnostics: { configPath, error: err.message },
      },
    };
  }

  const rawConfig = parsed as Partial<ServerConfig> & { drupalRoot?: unknown };

  if (typeof rawConfig.drupalRoot !== "string" || rawConfig.drupalRoot.length === 0) {
    const message = "Configuration must specify an absolute drupalRoot path";
    logger.error?.(message);
    return {
      config: null,
      configPath,
      error: {
        code: "E_CONFIG_INVALID_ROOT",
        message,
        diagnostics: { configPath, drupalRoot: rawConfig.drupalRoot },
      },
    };
  }

  const resolvedRoot = path.resolve(rawConfig.drupalRoot);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedRoot);
  } catch {
    const message = `Configured drupalRoot does not exist: ${resolvedRoot}`;
    logger.error?.(message);
    return {
      config: null,
      configPath,
      error: {
        code: "E_CONFIG_INVALID_ROOT",
        message,
        diagnostics: { configPath, drupalRoot: resolvedRoot },
      },
    };
  }

  if (!stat.isDirectory()) {
    const message = `Configured drupalRoot is not a directory: ${resolvedRoot}`;
    logger.error?.(message);
    return {
      config: null,
      configPath,
      error: {
        code: "E_CONFIG_INVALID_ROOT",
        message,
        diagnostics: { configPath, drupalRoot: resolvedRoot },
      },
    };
  }

  const baseConfig: ServerConfig = {
    drupalRoot: resolvedRoot,
    drushPath: rawConfig.drushPath,
    composerPath: rawConfig.composerPath,
    customModuleDirs: rawConfig.customModuleDirs,
    customThemeDirs: rawConfig.customThemeDirs,
    timeouts: rawConfig.timeouts,
    maxParallelCli: rawConfig.maxParallelCli,
    cacheTtlMs: rawConfig.cacheTtlMs,
  };

  const configWithDefaults = applyDefaults(baseConfig);

  logger.info?.(
    `Loaded DriftCore config for Drupal root ${configWithDefaults.drupalRoot}`,
  );

  return {
    config: configWithDefaults,
    configPath,
  };
}

