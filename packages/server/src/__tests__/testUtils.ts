import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BinaryValidationResult, ServerConfig, ServerState } from "../types.js";

interface TempProjectOptions {
  customModules?: string[];
  customThemes?: string[];
  composerRequire?: Record<string, string>;
  composerPackages?: Array<{ name: string; version: string; type?: string }>;
  createConfigSyncDir?: "project" | "drupal_parent" | "site_files";
  createSettingsPhp?: boolean;
  createSettingsLocal?: boolean;
  createDrushSitesDir?: boolean;
  envFiles?: string[];
}

interface CreateStateOptions {
  binaryValidation?: Partial<BinaryValidationResult>;
}

export function createTempProject(
  options: TempProjectOptions = {},
): { config: ServerConfig; cleanup: () => void; projectRoot: string; drupalRoot: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-project-truth-"));
  const projectRoot = tmpDir;
  const drupalRoot = path.join(projectRoot, "web");

  fs.mkdirSync(drupalRoot, { recursive: true });

  const composerJson = {
    name: "acme/site",
    type: "project",
    require: {
      "drupal/core-recommended": "^11.1",
      "drupal/token": "^1.11",
      ...(options.composerRequire ?? {}),
    },
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.json"),
    JSON.stringify(composerJson, null, 2),
    "utf8",
  );

  const composerLock = {
    packages: [
      {
        name: "drupal/core-recommended",
        version: "11.1.4",
        type: "drupal-core",
      },
      {
        name: "drupal/token",
        version: "1.11.0",
        type: "drupal-module",
      },
      ...(options.composerPackages ?? []),
    ],
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.lock"),
    JSON.stringify(composerLock, null, 2),
    "utf8",
  );

  for (const moduleName of options.customModules ?? ["acme_blog"]) {
    fs.mkdirSync(path.join(projectRoot, "web", "modules", "custom", moduleName), {
      recursive: true,
    });
  }

  for (const themeName of options.customThemes ?? ["acme_theme"]) {
    fs.mkdirSync(path.join(projectRoot, "web", "themes", "custom", themeName), {
      recursive: true,
    });
  }

  if (options.createSettingsPhp) {
    fs.mkdirSync(path.join(drupalRoot, "sites", "default"), { recursive: true });
    fs.writeFileSync(path.join(drupalRoot, "sites", "default", "settings.php"), "<?php", "utf8");
  }

  if (options.createSettingsLocal) {
    fs.mkdirSync(path.join(drupalRoot, "sites", "default"), { recursive: true });
    fs.writeFileSync(
      path.join(drupalRoot, "sites", "default", "settings.local.php"),
      "<?php",
      "utf8",
    );
  }

  if (options.createDrushSitesDir) {
    fs.mkdirSync(path.join(projectRoot, "drush", "sites"), { recursive: true });
  }

  for (const envFile of options.envFiles ?? []) {
    fs.writeFileSync(path.join(projectRoot, envFile), "APP_ENV=test\n", "utf8");
  }

  if (options.createConfigSyncDir === "project") {
    fs.mkdirSync(path.join(projectRoot, "config", "sync"), { recursive: true });
  } else if (options.createConfigSyncDir === "drupal_parent") {
    fs.mkdirSync(path.resolve(drupalRoot, "../config/sync"), { recursive: true });
  } else if (options.createConfigSyncDir === "site_files") {
    fs.mkdirSync(path.join(drupalRoot, "sites", "default", "files", "config_abc123"), {
      recursive: true,
    });
  }

  const config: ServerConfig = {
    drupalRoot,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 0, pml: 0 },
  };

  return {
    config,
    projectRoot,
    drupalRoot,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

export function createState(
  config: ServerConfig | null,
  options: CreateStateOptions = {},
): ServerState {
  const binaryValidation: BinaryValidationResult = {
    drush: { resolved: null, exists: false },
    composer: { resolved: null, exists: false },
    ...options.binaryValidation,
  };

  return {
    resources: [],
    tools: [],
    logger: console,
    config,
    binaryValidation,
    configError: config
      ? undefined
      : {
          code: "E_CONFIG_INVALID_ROOT",
          message: "DriftCore configuration is missing or invalid",
        },
    runOperation: async (_meta, executor) => executor(),
  };
}
