import assert from "node:assert/strict";
import { ChildProcess, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execute = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const expectedResources = [
  "driftcore://project/manifest", "driftcore://project/modules",
  "driftcore://project/config-layout", "driftcore://project/checks",
].sort();
const expectedTools = [
  "drift_drush_status", "drift_drush_pml", "drift_composer_info",
  "drift_composer_outdated", "drift_upgrade_assessment",
  "drift_config_drift_assessment", "drift_scaffold_plan",
  ...["cache_rebuild", "module_scaffold", "config_export"].flatMap((workflow) =>
    ["preview", "apply", "verify"].map((phase) => `drift_${workflow}_${phase}`)),
].sort();

// SDK v1 exposes PID but not exit status. Keep this integration-only observation
// isolated here so a signaled shutdown cannot masquerade as a clean EOF exit.
class ObservedTransport extends StdioClientTransport {
  child?: ChildProcess;
  stdout = "";

  override async start(): Promise<void> {
    await super.start();
    const child: unknown = Reflect.get(this, "_process");
    assert.ok(child instanceof ChildProcess, "SDK child process must be observable");
    this.child = child;
    // Observe bytes without changing the encoding expected by the SDK parser.
    child.stdout?.on("data", (chunk: Buffer) => { this.stdout += chunk.toString("utf8"); });
  }
}

async function npmCommand(args: string[], cwd: string): Promise<string> {
  const result = await execute(npm, args, {
    cwd, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });
  return result.stdout;
}

async function proveConsumer(executable: string, projectRoot: string, cwd: string, args: string[]): Promise<void> {
  const transport = new ObservedTransport({ command: executable, args, cwd, stderr: "pipe" });
  const client = new Client({ name: "packed-consumer", version: "1.0.0" });
  const protocolErrors: Error[] = [];
  client.onerror = (error) => protocolErrors.push(error);
  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
  try {
    await client.connect(transport, { timeout: 10000 });
    assert.deepEqual(client.getServerVersion(), { name: "driftcore", version: "0.2.0" });
    assert.ok(client.getServerCapabilities()?.resources);
    assert.ok(client.getServerCapabilities()?.tools);
    const resources = await client.listResources({}, { timeout: 10000 });
    assert.deepEqual(resources.resources.map((resource) => resource.uri).sort(), expectedResources);
    const tools = await client.listTools({}, { timeout: 10000 });
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), expectedTools);
    const resource = await client.readResource({ uri: "driftcore://project/manifest" }, { timeout: 10000 });
    assert.equal(resource.contents.length, 1);
    const content = resource.contents[0];
    assert.ok("text" in content);
    const manifest = JSON.parse(content.text);
    assert.equal(manifest.status, "ok");
    assert.equal(manifest.data.project_root, projectRoot);
    assert.equal(manifest.data.drupal_root, path.join(projectRoot, "web"));
    assert.equal(manifest.data.composer.name, "packed-consumer/site");
    const result = await client.callTool({ name: "drift_composer_info", arguments: {} }, undefined, { timeout: 10000 });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      status: "ok",
      data: {
        manifest: { name: "packed-consumer/site", require: { "drupal/core-recommended": "^11" } },
        lock_summary: { packages: [{ name: "drupal/core-recommended", version: "11.1.4" }] },
      },
    });
    await client.close();
    assert.equal(transport.child?.exitCode, 0, "server must exit 0 after EOF");
    assert.equal(transport.child?.signalCode, null, "shutdown must not require a kill signal");
    assert.deepEqual(protocolErrors, []);
    const lines = transport.stdout.trim().split("\n");
    assert.ok(lines.length >= 5);
    for (const line of lines) assert.equal(JSON.parse(line).jsonrpc, "2.0");
    assert.match(stderr, /kind=resource name=project_manifest status=ok/);
    assert.match(stderr, /kind=tool name=drift_composer_info status=ok/);
  } catch (error) {
    throw new Error(`Packed executable failed: ${String(error)}; stderr: ${stderr}`);
  } finally {
    await client.close();
    await transport.close();
  }
}

export async function runPackedMcpSmoke(): Promise<void> {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-packed-"));
  try {
    const packed: unknown = JSON.parse(await npmCommand([
      "pack", "--json", "--pack-destination", temporary,
    ], packageRoot));
    assert.ok(Array.isArray(packed) && packed.length === 1);
    const entry = packed[0] as { filename: string; files: Array<{ path: string }> };
    assert.equal(entry.filename, "driftcore-server-0.2.0.tgz");
    const files = entry.files.map((file) => file.path);
    for (const required of ["dist/bin/mcp.js", "dist/bin/http.js", "dist/bin/stdio.js",
      "package.json", "README.md", "LICENSE"]) assert.ok(files.includes(required), required);
    assert.ok(!files.some((file) => file.startsWith("node_modules/") || file.startsWith("src/") ||
      file.startsWith("dist/__tests__/") || file.startsWith("dist/integration/")));
    const consumer = path.join(temporary, "consumer");
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "clean-consumer", private: true }));
    await npmCommand(["install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund",
      "--fetch-retries=0", "--fetch-timeout=20000", path.join(temporary, entry.filename)], consumer);
    const installed = path.join(consumer, "node_modules", "@driftcore", "server");
    assert.ok(fs.existsSync(path.join(installed, "dist", "bin", "mcp.js")));
    for (const file of ["README.md", "LICENSE"]) assert.ok(fs.existsSync(path.join(installed, file)));
    const executable = path.join(consumer, "node_modules", ".bin", "driftcore");
    fs.accessSync(executable, fs.constants.X_OK);
    const projectRoot = path.join(consumer, "site");
    const nested = path.join(projectRoot, "web", "modules", "custom");
    fs.mkdirSync(path.join(projectRoot, "web", "core"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    const composer = { name: "packed-consumer/site", require: { "drupal/core-recommended": "^11" } };
    fs.writeFileSync(path.join(projectRoot, "composer.json"), JSON.stringify(composer));
    fs.writeFileSync(path.join(projectRoot, "composer.lock"), JSON.stringify({
      packages: [{ name: "drupal/core-recommended", version: "11.1.4" }],
    }));
    await proveConsumer(executable, projectRoot, consumer, ["--project-root", projectRoot]);
    await proveConsumer(executable, projectRoot, nested, []);
    console.info("Packed MCP consumer smoke passed: installed executable, 4 resources, 16 tools, manifest, read-only call, CLI root and upward discovery, protocol-only stdout, exit 0.");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPackedMcpSmoke().catch((error: unknown) => {
    console.error("Packed MCP smoke failed:", error);
    process.exitCode = 1;
  });
}
