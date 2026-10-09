import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { runMcpStdio } from "../bin/mcp.js";
import { createDriftCoreMcpServer } from "../mcp/server.js";
import { DRIFTCORE_RESOURCE_URIS } from "../mcp/resources.js";
import { createState, createTempProject } from "./testUtils.js";

const entryPoint = fileURLToPath(new URL("../bin/mcp.js", import.meta.url));
const packagePath = new URL("../../package.json", import.meta.url);
const expectedTools = [
  "drift_drush_status", "drift_drush_pml", "drift_composer_info",
  "drift_composer_outdated", "drift_upgrade_assessment",
  "drift_config_drift_assessment", "drift_scaffold_plan",
  ...["cache_rebuild", "module_scaffold", "config_export"].flatMap((workflow) =>
    ["preview", "apply", "verify"].map((phase) => `drift_${workflow}_${phase}`)),
].sort();

test("MCP server initializes and exposes the complete registered surface", async () => {
  const server = createDriftCoreMcpServer(createState(null));
  const client = new Client({ name: "task7-client", version: "1.0.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { version } = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.deepEqual(client.getServerVersion(), { name: "driftcore", version });
    assert.ok(client.getServerCapabilities()?.resources);
    assert.ok(client.getServerCapabilities()?.tools);
    assert.deepEqual((await client.listResources()).resources.map((r) => r.uri),
      [...DRIFTCORE_RESOURCE_URIS]);
    assert.deepEqual((await client.listTools()).tools.map((t) => t.name).sort(), expectedTools);
    const resource = await client.readResource({ uri: DRIFTCORE_RESOURCE_URIS[0] });
    assert.ok("text" in resource.contents[0]);
    assert.equal(JSON.parse(resource.contents[0].text as string).status, "not_configured");
    const result = await client.callTool({ name: "drift_composer_info", arguments: {} });
    assert.equal((result.structuredContent as { status: string }).status, "not_configured");
    assert.equal(result.isError, false);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP executable reserves stdout for protocol and logs operations to stderr", { timeout: 20000 }, async () => {
  const fixture = createTempProject();
  const configPath = `${fixture.projectRoot}/driftcore.config.json`;
  fs.writeFileSync(configPath, JSON.stringify(fixture.config));
  const child = spawn(process.execPath, [entryPoint, "--config", configPath], {
    cwd: fixture.projectRoot, env: { ...process.env, DRIFTCORE_CONFIG: "/missing/ignored.json" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  const lines: string[] = [];
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  const reader = createInterface({ input: child.stdout });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  reader.on("line", (line) => {
    lines.push(line);
    // Leave non-protocol output in lines so the final JSON assertion detects it.
    try {
      const message = JSON.parse(line) as Record<string, unknown>;
      if (typeof message.id === "number") pending.get(message.id)?.(message);
    } catch { /* Checked after the child exits. */ }
  });
  let id = 0;
  const request = (method: string, params?: unknown) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Timed out waiting for ${method}; stderr: ${stderr}`));
    }, 10000);
    pending.set(requestId, (value) => {
      clearTimeout(timeout);
      pending.delete(requestId);
      resolve(value);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
  });
  try {
    const initialized = await request("initialize", {
      protocolVersion: "2025-11-25", capabilities: {},
      clientInfo: { name: "stdio-test", version: "1.0.0" },
    });
    assert.equal(initialized.error, undefined);
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    assert.equal((await request("resources/list")).error, undefined);
    assert.equal((await request("tools/list")).error, undefined);
    const resource = await request("resources/read", { uri: DRIFTCORE_RESOURCE_URIS[0] });
    const resourceResult = resource.result as { contents: Array<{ text: string }> };
    assert.equal(JSON.parse(resourceResult.contents[0].text).status, "ok");
    const tool = await request("tools/call", { name: "drift_composer_info", arguments: {} });
    const toolResult = tool.result as { structuredContent: { status: string }; isError: boolean };
    assert.equal(toolResult.structuredContent.status, "ok");
    assert.equal(toolResult.isError, false);
    child.stdin.end();
    const [code, signal] = await exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.equal(lines.length, 5);
    for (const line of lines) assert.equal(JSON.parse(line).jsonrpc, "2.0");
    assert.match(stderr, /kind=resource name=project_manifest status=ok/);
    assert.match(stderr, /kind=tool name=drift_composer_info status=ok/);
  } finally {
    child.kill();
    reader.close();
    fixture.cleanup();
  }
});

test("MCP executable reports startup errors on stderr with a nonzero exit", () => {
  const fixture = createTempProject();
  try {
    const malformedPath = `${fixture.projectRoot}/invalid.json`;
    fs.writeFileSync(malformedPath, "{invalid");
    for (const args of [
      ["--unknown"], ["--config"], ["--config="],
      ["--config", `${fixture.projectRoot}/missing.json`], ["--config", malformedPath],
    ]) {
      const result = spawnSync(process.execPath, [entryPoint, ...args], {
        cwd: fixture.projectRoot, encoding: "utf8", timeout: 10000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /MCP STDIO server failed/);
    }
  } finally {
    fixture.cleanup();
  }
});

test("MCP runner is importable and propagates startup failure without exiting the caller", async () => {
  const fixture = createTempProject();
  try {
    await assert.rejects(runMcpStdio({ configPath: `${fixture.projectRoot}/missing.json` }),
      /E_CONFIG_NOT_FOUND/);
  } finally {
    fixture.cleanup();
  }
});

test("MCP CLI help stays on stderr without starting the protocol", () => {
  const result = spawnSync(process.execPath, [entryPoint, "--help"], {
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Usage:.*--config/);
});
