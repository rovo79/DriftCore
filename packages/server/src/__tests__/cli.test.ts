import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "../cli.js";
import { loadServerConfig } from "../config.js";

const logger = { info() {}, warn() {}, error() {} };

test("CLI parses separate and equals paths, both options, and help", () => {
  assert.deepEqual(parseCliArgs(["--project-root", "/a b", "--config=/c=d.json"]),
    { projectRoot: "/a b", configPath: "/c=d.json" });
  assert.deepEqual(parseCliArgs(["--project-root=/a", "--config", "/c"]),
    { projectRoot: "/a", configPath: "/c" });
  assert.deepEqual(parseCliArgs(["-h"]), { help: true });
});

test("CLI rejects unknown options, positionals, and missing path values", () => {
  for (const args of [["--unknown"], ["site"], ["--config"], ["--config="],
    ["--project-root"], ["--project-root="], ["--config", "--project-root", "/a"],
    ["--project-root", "-h"]]) {
    assert.throws(() => parseCliArgs(args));
  }
});

test("consumer resolution obeys every precedence level and preserves legacy roots", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-precedence-"));
  const oldCwd = process.cwd();
  const oldEnv = process.env.DRIFTCORE_CONFIG;
  try {
    const project = path.join(dir, "site");
    const web = path.join(project, "web");
    fs.mkdirSync(path.join(web, "core"), { recursive: true });
    fs.writeFileSync(path.join(project, "composer.json"),
      JSON.stringify({ require: { "drupal/core-recommended": "^11" } }));
    const roots = ["explicit", "environment", "local"].map((name) => path.join(dir, name));
    roots.forEach((root) => fs.mkdirSync(root));
    const explicit = path.join(dir, "explicit.json");
    const environment = path.join(dir, "environment.json");
    const local = path.join(project, "driftcore.config.json");
    [explicit, environment, local].forEach((file, index) =>
      fs.writeFileSync(file, JSON.stringify({ drupalRoot: roots[index], maxParallelCli: 3 })));
    process.chdir(project);
    process.env.DRIFTCORE_CONFIG = environment;
    const load = (options = {}) => loadServerConfig({ logger, discoverProject: true, ...options });
    assert.equal(load({ projectRoot: project, configPath: explicit }).config?.drupalRoot, web);
    assert.equal(load({ projectRoot: project, configPath: explicit }).config?.maxParallelCli, 3);
    process.env.DRIFTCORE_CONFIG = "/missing/ignored.json";
    assert.equal(load({ projectRoot: project }).config?.drupalRoot, web);
    assert.equal(load({ configPath: explicit }).config?.drupalRoot, roots[0]);
    process.env.DRIFTCORE_CONFIG = environment;
    assert.equal(load().config?.drupalRoot, roots[1]);
    delete process.env.DRIFTCORE_CONFIG;
    assert.equal(load().config?.drupalRoot, roots[2]);
    fs.rmSync(local);
    assert.equal(load().config?.drupalRoot, web);
    assert.equal(loadServerConfig({ logger }).error?.code, "E_CONFIG_NOT_FOUND");
    assert.equal(load({ configPath: "/missing/explicit.json" }).error?.code, "E_CONFIG_NOT_FOUND");
    process.env.DRIFTCORE_CONFIG = "/missing/environment.json";
    assert.equal(load().error?.code, "E_CONFIG_NOT_FOUND");
    delete process.env.DRIFTCORE_CONFIG;
    fs.writeFileSync(local, "{invalid");
    assert.equal(load().error?.code, "E_JSON_PARSE");
    fs.writeFileSync(local, "null");
    assert.equal(load().error?.code, "E_CONFIG_INVALID_ROOT");
    assert.equal(load({ projectRoot: path.join(dir, "missing") }).error?.code, "E_CONFIG_INVALID_ROOT");
  } finally {
    process.chdir(oldCwd);
    if (oldEnv === undefined) delete process.env.DRIFTCORE_CONFIG;
    else process.env.DRIFTCORE_CONFIG = oldEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("MCP startup without a project exits 1 with concise stderr and no stdout", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-no-project-"));
  try {
    const env = { ...process.env };
    delete env.DRIFTCORE_CONFIG;
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL("../bin/mcp.js", import.meta.url))],
      { cwd: dir, env, encoding: "utf8", timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /No Drupal project found/);
    assert.doesNotMatch(result.stderr, /at .*\.js:/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
