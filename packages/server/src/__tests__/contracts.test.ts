import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createMCPServer } from "../index.js";
import type {
  BinaryValidationResult,
  ResourceOrToolResponse,
  ResponseStatus,
  ServerConfig,
  ServerState,
} from "../types.js";
import { listSchemaResources } from "../features/schemaResources.js";
import { listDiscoveredResources } from "../features/discoveredResources.js";
import { getProjectChecks } from "../features/projectChecks.js";
import { getProjectConfigLayout } from "../features/projectConfigLayout.js";
import { getProjectManifest } from "../features/projectManifest.js";
import { getProjectModules } from "../features/projectModules.js";
import { runDrushStatus, runDrushPml } from "../features/drushTools.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";
import {
  runConfigDriftAssessment,
  runScaffoldPlanning,
  runUpgradeAssessment,
} from "../features/workflows/index.js";
import { createWriteFixture } from "./writeTestUtils.js";
import type {
  CliExecutionOptions,
  CliExecutionResult,
} from "../features/sandboxExecution.js";

type RunnerStub = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

const VALID_STATUSES: ResponseStatus[] = [
  "ok",
  "degraded",
  "error",
  "timeout",
  "not_configured",
];

function assertStatus(status: ResponseStatus) {
  assert.ok(VALID_STATUSES.includes(status));
}

function assertEnvelopeTopLevelKeys(response: ResourceOrToolResponse) {
  const keys = Object.keys(response).sort();
  assert.ok(keys.includes("status"));
  for (const key of keys) {
    assert.ok(["status", "data", "error"].includes(key));
  }
}

function assertErrorShape(response: ResourceOrToolResponse) {
  assert.ok(response.error);
  assert.equal(typeof response.error?.code, "string");
  assert.equal(typeof response.error?.message, "string");
}

function createTempProject(): {
  config: ServerConfig;
  cleanup: () => void;
  rootDir: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-contracts-"));
  const rootDir = tmpDir;
  const drupalRoot = path.join(rootDir, "web");

  fs.mkdirSync(drupalRoot, { recursive: true });
  fs.mkdirSync(path.join(rootDir, "web", "modules", "custom", "acme_blog"), {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(rootDir, "composer.json"),
    JSON.stringify(
      {
        name: "acme/site",
        type: "project",
        require: {
          "drupal/core-recommended": "^11.1",
          "drupal/token": "^1.11",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    path.join(rootDir, "composer.lock"),
    JSON.stringify(
      {
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
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const config: ServerConfig = {
    drupalRoot,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 0, pml: 0 },
  };

  const cleanup = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  return { config, cleanup, rootDir };
}

function createState(
  config: ServerConfig | null,
  binaryValidationOverrides?: Partial<BinaryValidationResult>,
): ServerState {
  return {
    resources: [...listSchemaResources(), ...listDiscoveredResources()],
    tools: [],
    logger: console,
    config,
    binaryValidation: {
      drush: { resolved: null, exists: false },
      composer: { resolved: null, exists: false },
      ...binaryValidationOverrides,
    },
    configError: config
      ? undefined
      : {
          code: "E_CONFIG_INVALID_ROOT",
          message: "DriftCore configuration is missing or invalid",
        },
    runOperation: async (_meta, executor) => executor(),
  };
}

function makeRunnerStub(stdout: string): RunnerStub {
  return async () => ({
    stdout,
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 5,
  });
}

function makeTimeoutRunnerStub(): RunnerStub {
  return async () => ({
    stdout: "",
    stderr: "timed out",
    exitCode: 1,
    timedOut: true,
    durationMs: 50,
  });
}

async function fetchJson(baseUrl: string, endpoint: string): Promise<any> {
  const response = await fetch(`${baseUrl}${endpoint}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function fetchJsonRequest(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${endpoint}`, init);
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("transport route contracts", () => {
  it("/health returns stable shape", async () => {
    const server = createMCPServer({ logger: console });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as { port: number };
      const baseUrl = `http://localhost:${address.port}`;
      const health = await fetchJson(baseUrl, "/health");

      const keys = Object.keys(health).sort();
      for (const key of [
        "binaries",
        "capabilities",
        "configured",
        "resources",
        "status",
        "tools",
      ]) {
        assert.ok(keys.includes(key));
      }
      assert.equal(health.status, "ok");
      assert.equal(typeof health.configured, "boolean");
      assert.equal(typeof health.tools, "number");
      assert.equal(typeof health.resources, "number");
      assert.equal(typeof health.binaries?.drush?.exists, "boolean");
      assert.equal(typeof health.binaries?.composer?.exists, "boolean");
      assert.equal(typeof health.capabilities?.local_only, "boolean");
      assert.equal(typeof health.capabilities?.redaction_enabled, "boolean");
      assert.equal(typeof health.capabilities?.rate_limiting_enabled, "boolean");
      assert.equal(health.capabilities?.write_disabled, false);
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("/resources returns resources with required keys", async () => {
    const server = createMCPServer({ logger: console });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as { port: number };
      const baseUrl = `http://localhost:${address.port}`;
      const payload = await fetchJson(baseUrl, "/resources");

      assert.deepEqual(Object.keys(payload).sort(), ["resources"]);
      assert.ok(Array.isArray(payload.resources));
      const resourceIds = payload.resources.map((resource: { id: string }) => resource.id);
      assert.ok(resourceIds.includes("project_modules"));
      assert.ok(resourceIds.includes("project_config_layout"));
      assert.ok(resourceIds.includes("project_checks"));
      for (const resource of payload.resources) {
        for (const key of ["id", "name", "description", "mimeType", "data"]) {
          assert.ok(key in resource);
        }
      }
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("/tools returns tools with required keys", async () => {
    const server = createMCPServer({ logger: console });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as { port: number };
      const baseUrl = `http://localhost:${address.port}`;
      const payload = await fetchJson(baseUrl, "/tools");

      assert.deepEqual(Object.keys(payload).sort(), ["tools"]);
      assert.ok(Array.isArray(payload.tools));
      const toolNames = payload.tools.map((tool: { name: string }) => tool.name);
      assert.ok(toolNames.includes("drift.upgrade_assessment"));
      assert.ok(toolNames.includes("drift.config_drift_assessment"));
      assert.ok(toolNames.includes("drift.scaffold_plan"));
      assert.ok(toolNames.includes("drift.cache_rebuild"));
      assert.ok(toolNames.includes("drift.module_scaffold"));
      assert.ok(toolNames.includes("drift.config_export"));
      for (const tool of payload.tools) {
        for (const key of ["name", "description", "command"]) {
          assert.ok(key in tool);
        }
        for (const key of Object.keys(tool)) {
          assert.ok(["name", "description", "command", "args", "examples"].includes(key));
        }
      }
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});

describe("response envelope contracts", () => {
  it("project_manifest envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectManifest(createState(config));
      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);

      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "capabilities",
        "composer",
        "custom_modules",
        "custom_themes",
        "drupal_core_version",
        "drupal_root",
        "project_root",
        "project_type",
        "schema_version",
      ]);
      assert.equal(response.data?.schema_version, "0.2.0");
    } finally {
      cleanup();
    }
  });

  it("project_modules envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectModules(createState(config), {
        runPml: async () => ({
          status: "ok",
          data: {
            modules: [{ name: "node", type: "core", status: "enabled" }],
            themes: [{ name: "claro", type: "core", status: "enabled" }],
          },
        }),
      });

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), ["modules", "summary", "themes"]);
      assert.ok(Array.isArray(response.data?.modules));
      assert.ok(Array.isArray(response.data?.themes));
      assert.deepEqual(Object.keys(response.data?.summary ?? {}).sort(), [
        "custom",
        "enabled",
        "total",
      ]);
    } finally {
      cleanup();
    }
  });

  it("project_config_layout envelope has stable keys and data shape", async () => {
    const { config, cleanup, rootDir } = createTempProject();
    try {
      fs.mkdirSync(path.join(rootDir, "config", "sync"), { recursive: true });

      const response = await getProjectConfigLayout(createState(config), {
        runStatus: async () => ({
          status: "ok",
          data: {
            drupal_version: "11.1.5",
            php_version: "8.4.14",
            database_driver: "sqlite",
            site_path: "sites/default",
            details: {
              "config-sync": path.join(rootDir, "config", "sync"),
            },
          },
        }),
      });

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "detection_method",
        "environment_indicators",
        "has_config_split",
        "sync_directory",
      ]);
    } finally {
      cleanup();
    }
  });

  it("project_checks envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectChecks(
        createState(config, {
          drush: { resolved: "/usr/local/bin/drush", exists: true },
          composer: { resolved: "/usr/local/bin/composer", exists: true },
        }),
        {
          runStatus: async () => ({
            status: "ok",
            data: {
              drupal_version: "11.1.5",
              php_version: "8.4.14",
              database_driver: "sqlite",
              site_path: "sites/default",
              details: {
                "config-sync": "config/sync",
              },
            },
          }),
        },
      );

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "capabilities",
        "composer_available",
        "composer_json_present",
        "config_sync_detected",
        "drupal_root_valid",
        "drush_available",
        "warnings",
      ]);
    } finally {
      cleanup();
    }
  });

  it("drush_status envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushStatus(
        createState(config),
        makeRunnerStub(
          JSON.stringify({
            "drupal-version": "11.1.5",
            "php-version": "8.4.14",
            "db-driver": "sqlite",
            site: "sites/default",
          }),
        ),
      );

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "database_driver",
        "details",
        "drupal_version",
        "php_version",
        "site_path",
      ]);
    } finally {
      cleanup();
    }
  });

  it("drush_pml envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushPml(
        createState(config),
        makeRunnerStub(
          JSON.stringify({
            modules: {
              node: { status: "Enabled", package: "Core", path: "core/modules/node" },
            },
            themes: {
              claro: { status: "Enabled", package: "Core", path: "core/themes/claro" },
            },
          }),
        ),
      );

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), ["modules", "themes"]);
      assert.ok(Array.isArray(response.data?.modules));
      assert.ok(Array.isArray(response.data?.themes));
    } finally {
      cleanup();
    }
  });

  it("composer_info envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerInfo(createState(config));
      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);

      const keys = Object.keys(response.data ?? {}).sort();
      assert.ok(keys.includes("manifest"));
      assert.ok(["lock_summary", "manifest"].every((k) => keys.includes(k) || k === "lock_summary"));
    } finally {
      cleanup();
    }
  });

  it("composer_outdated envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerOutdated(
        createState(config),
        makeRunnerStub(
          JSON.stringify({
            installed: [
              {
                name: "drupal/token",
                version: "1.11.0",
                latest: "1.12.0",
                "latest-status": "semver-safe-update",
              },
            ],
          }),
        ),
      );

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), ["packages"]);
      assert.ok(Array.isArray(response.data?.packages));
    } finally {
      cleanup();
    }
  });

  it("upgrade_assessment envelope has stable keys and data shape", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runUpgradeAssessment(createState(config), {
        runOutdated: async () => ({
          status: "ok",
          data: {
            packages: [
              {
                name: "drupal/core-recommended",
                current_version: "10.2.0",
                latest_version: "11.0.0",
                constraint: "^10.2",
                package_type: "drupal-core",
                latest_status: "update-possible",
              },
            ],
          },
        }),
      });

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "candidates",
        "drupal_core_version",
        "project_type",
        "suggested_commands",
        "summary",
        "total_outdated",
      ]);
      assert.ok(Array.isArray(response.data?.candidates));
      assert.ok(Array.isArray(response.data?.suggested_commands));
    } finally {
      cleanup();
    }
  });

  it("config_drift_assessment envelope has stable keys and data shape", async () => {
    const { config, cleanup, rootDir } = createTempProject();
    try {
      fs.mkdirSync(path.join(rootDir, "config", "sync"), { recursive: true });
      fs.writeFileSync(path.join(rootDir, "config", "sync", "system.site.yml"), "foo: bar\n", "utf8");

      const response = await runConfigDriftAssessment(createState(config), {
        runStatus: async () => ({
          status: "ok",
          data: {
            drupal_version: "11.1.5",
            php_version: "8.4.14",
            database_driver: "sqlite",
            site_path: "sites/default",
            details: {
              "config-sync": path.join(rootDir, "config", "sync"),
            },
          },
        }),
        runConfigStatus: async () => ({
          status: "ok",
          data: [
            { name: "system.site", state: "changed" as const },
          ],
        }),
      });

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "changed_items",
        "drift_detected",
        "has_config_split",
        "summary",
        "suggested_commands",
        "sync_directory",
        "sync_directory_exists",
      ].sort());
      assert.ok(Array.isArray(response.data?.changed_items));
    } finally {
      cleanup();
    }
  });

  it("scaffold_plan envelope has stable keys and data shape", async () => {
    const { config, cleanup, rootDir } = createTempProject();
    try {
      const moduleRoot = path.join(rootDir, "web", "modules", "custom", "acme_blog");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.info.yml"), "name: Acme Blog\n", "utf8");
      fs.writeFileSync(path.join(moduleRoot, "acme_blog.module"), "<?php\n", "utf8");
      fs.mkdirSync(path.join(moduleRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(moduleRoot, "templates"), { recursive: true });

      const response = await runScaffoldPlanning(createState(config), {
        machine_name: "acme_news",
        target_type: "module",
      });

      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "ok");
      assert.ok(response.data);
      assert.deepEqual(Object.keys(response.data ?? {}).sort(), [
        "conventions_detected",
        "drupal_core_version",
        "files",
        "machine_name",
        "summary",
        "target_directory",
        "target_type",
      ]);
      assert.ok(Array.isArray(response.data?.files));
      assert.ok(Array.isArray(response.data?.conventions_detected));
    } finally {
      cleanup();
    }
  });
});

describe("error envelope contracts", () => {
  it("project_manifest returns not_configured error envelope", async () => {
    const response = await getProjectManifest(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("project_manifest degraded includes error details", async () => {
    const { config, cleanup, rootDir } = createTempProject();
    try {
      fs.unlinkSync(path.join(rootDir, "composer.lock"));

      const response = await getProjectManifest(createState(config));
      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "degraded");
      assert.ok(response.data);
      assertErrorShape(response);
      assert.equal(response.error?.code, "E_MANIFEST_INCOMPLETE");
    } finally {
      cleanup();
    }
  });

  it("project_modules returns not_configured error envelope", async () => {
    const response = await getProjectModules(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("project_config_layout returns not_configured error envelope", async () => {
    const response = await getProjectConfigLayout(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("project_checks returns ok diagnostics when server is not configured", async () => {
    const response = await getProjectChecks(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "ok");
    assert.ok(response.data);
    assert.equal(response.data?.drupal_root_valid, false);
  });

  it("drush_status timeout maps to timeout envelope", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushStatus(createState(config), makeTimeoutRunnerStub());
      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "timeout");
      assertErrorShape(response);
      assert.equal(response.error?.code, "E_TIMEOUT");
    } finally {
      cleanup();
    }
  });

  it("composer_outdated timeout maps to timeout envelope", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerOutdated(createState(config), makeTimeoutRunnerStub());
      assertEnvelopeTopLevelKeys(response);
      assertStatus(response.status);
      assert.equal(response.status, "timeout");
      assertErrorShape(response);
      assert.equal(response.error?.code, "E_TIMEOUT");
    } finally {
      cleanup();
    }
  });

  it("drush_status not_configured returns stable error envelope", async () => {
    const response = await runDrushStatus(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("drush_pml not_configured returns stable error envelope", async () => {
    const response = await runDrushPml(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("composer_info not_configured returns stable error envelope", async () => {
    const response = await runComposerInfo(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("composer_outdated not_configured returns stable error envelope", async () => {
    const response = await runComposerOutdated(createState(null));
    assertEnvelopeTopLevelKeys(response);
    assertStatus(response.status);
    assert.equal(response.status, "not_configured");
    assertErrorShape(response);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("write routes expose stable preview/apply/verify envelopes over HTTP", async () => {
    const fixture = createWriteFixture();
    const server = createMCPServer({ logger: console, configPath: fixture.configPath });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as { port: number };
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const cachePreview = await fetchJsonRequest(baseUrl, "/workflows/cache-rebuild/preview");
      assert.equal(cachePreview.status, 200);
      assert.equal(cachePreview.body.status, "ok");
      assert.equal(typeof cachePreview.body.data?.preview_token, "string");

      const cacheApply = await fetchJsonRequest(baseUrl, "/workflows/cache-rebuild/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_token: cachePreview.body.data?.preview_token }),
      });
      assert.equal(cacheApply.status, 200);
      assert.equal(cacheApply.body.status, "ok");
      assert.equal(cacheApply.body.data?.result.command.includes("cache:rebuild"), true);

      const cacheVerify = await fetchJsonRequest(baseUrl, "/workflows/cache-rebuild/verify");
      assert.equal(cacheVerify.status, 200);
      assert.equal(cacheVerify.body.status, "ok");
      assert.equal(cacheVerify.body.data?.verified, true);

      const scaffoldPreview = await fetchJsonRequest(
        baseUrl,
        "/workflows/scaffold/preview?machine_name=acme_blog&target_type=module",
      );
      assert.equal(scaffoldPreview.status, 200);
      assert.equal(scaffoldPreview.body.status, "ok");
      assert.equal(scaffoldPreview.body.data?.preview.target_directory, "web/modules/custom/acme_blog");

      const scaffoldApply = await fetchJsonRequest(baseUrl, "/workflows/scaffold/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machine_name: "acme_blog",
          target_type: "module",
          preview_token: scaffoldPreview.body.data?.preview_token,
        }),
      });
      assert.equal(scaffoldApply.status, 200);
      assert.equal(scaffoldApply.body.status, "ok");
      assert.ok(
        scaffoldApply.body.data?.changes.some((change: { type: string; target: string }) => {
          return change.type === "file_created" && change.target.endsWith("acme_blog.info.yml");
        }),
      );

      const scaffoldVerify = await fetchJsonRequest(
        baseUrl,
        "/workflows/scaffold/verify?machine_name=acme_blog&target_type=module",
      );
      assert.equal(scaffoldVerify.status, 200);
      assert.equal(scaffoldVerify.body.status, "ok");
      assert.equal(scaffoldVerify.body.data?.verified, true);

      const exportPreview = await fetchJsonRequest(baseUrl, "/workflows/config-export/preview");
      assert.equal(exportPreview.status, 200);
      assert.equal(exportPreview.body.status, "ok");
      assert.equal(exportPreview.body.data?.preview.drift_detected, true);

      const exportApply = await fetchJsonRequest(baseUrl, "/workflows/config-export/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_token: exportPreview.body.data?.preview_token }),
      });
      assert.equal(exportApply.status, 200);
      assert.equal(exportApply.body.status, "ok");
      assert.ok(
        exportApply.body.data?.result.changed_files.some((file: string) => file.endsWith("system.site.yml")),
      );

      const exportVerify = await fetchJsonRequest(baseUrl, "/workflows/config-export/verify");
      assert.equal(exportVerify.status, 200);
      assert.equal(exportVerify.body.status, "ok");
      assert.equal(exportVerify.body.data?.verified, true);
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      fixture.cleanup();
    }
  });
});
