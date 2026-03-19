import fs from "node:fs";
import path from "node:path";
import type {
  BinaryValidationEntry,
  BinaryValidationResult,
  CacheTtlConfig,
  ErrorDetail,
  ServerConfig,
  TimeoutsConfig,
} from "./types.js";

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

const DEFAULT_REDACTION = {
  enabled: false,
  placeholder: "[redacted]",
};

const DEFAULT_RATE_LIMIT = {
  windowMs: 60000,
  maxRequests: 60,
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
    redaction: {
      enabled: raw.redaction?.enabled ?? DEFAULT_REDACTION.enabled,
      placeholder: raw.redaction?.placeholder ?? DEFAULT_REDACTION.placeholder,
    },
    rateLimit: {
      windowMs: raw.rateLimit?.windowMs ?? DEFAULT_RATE_LIMIT.windowMs,
      maxRequests: raw.rateLimit?.maxRequests ?? DEFAULT_RATE_LIMIT.maxRequests,
    },
  };
}

function canExecuteFile(target: string): boolean {
  try {
    fs.accessSync(target, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExecutableOnPath(command: string): string | null {
  const envPath = process.env.PATH;
  if (!envPath) {
    return null;
  }

  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT"])
    : [""];

  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension}`);
      if (fs.existsSync(candidate) && canExecuteFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function validateBinaryPath(candidate: string | undefined, fallback: string): BinaryValidationEntry {
  const resolvedCandidate = candidate && candidate.length > 0 ? candidate : fallback;

  if (resolvedCandidate.includes(path.sep) || path.isAbsolute(resolvedCandidate)) {
    const absolute = path.isAbsolute(resolvedCandidate)
      ? resolvedCandidate
      : path.resolve(resolvedCandidate);
    return {
      resolved: absolute,
      exists: fs.existsSync(absolute) && canExecuteFile(absolute),
    };
  }

  const onPath = resolveExecutableOnPath(resolvedCandidate);
  return {
    resolved: onPath ?? resolvedCandidate,
    exists: Boolean(onPath),
  };
}

export function validateBinaryPaths(config: ServerConfig | null): BinaryValidationResult {
  if (!config) {
    return {
      drush: { resolved: null, exists: false },
      composer: { resolved: null, exists: false },
    };
  }

  const projectRoot = path.dirname(config.drupalRoot);
  const drushFallback = fs.existsSync(path.join(projectRoot, "vendor", "bin", "drush"))
    ? path.join(projectRoot, "vendor", "bin", "drush")
    : "drush";
  const composerFallback = fs.existsSync(path.join(projectRoot, "vendor", "bin", "composer"))
    ? path.join(projectRoot, "vendor", "bin", "composer")
    : fs.existsSync(path.join(projectRoot, "composer.phar"))
      ? path.join(projectRoot, "composer.phar")
      : "composer";

  return {
    drush: validateBinaryPath(config.drushPath, drushFallback),
    composer: validateBinaryPath(config.composerPath, composerFallback),
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
    redaction: rawConfig.redaction,
    rateLimit: rawConfig.rateLimit,
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

