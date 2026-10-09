import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerReadOnlyTools } from "../mcp/readTools.js";
import { EmptyInput, ScaffoldInput } from "../mcp/toolSchemas.js";
import { createState, createTempProject } from "./testUtils.js";
import type { OperationMeta, ResourceOrToolResponse, ServerState } from "../types.js";

const expectedToolNames = [
  "drift_drush_status",
  "drift_drush_pml",
  "drift_composer_info",
  "drift_composer_outdated",
  "drift_upgrade_assessment",
  "drift_config_drift_assessment",
  "drift_scaffold_plan",
];

async function createConnectedClient(state: ServerState) {
  const server = new McpServer({ name: "driftcore-read-tools-test", version: "0.1.0" });
  registerReadOnlyTools(server, state);

  const client = new Client({ name: "driftcore-read-tools-client", version: "0.1.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

async function closeClientAndServer(client: Client, server: McpServer) {
  await client.close();
  await server.close();
}

function createReadToolsFixture() {
  const fixture = createTempProject({ createConfigSyncDir: "project" });
  const composerPath = path.join(fixture.projectRoot, "fake-composer.mjs");

  fs.writeFileSync(
    composerPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "outdated" && args[1] === "--format=json") {
  console.log(JSON.stringify({
    installed: [{
      name: "drupal/token",
      version: "1.11.0",
      latest: "1.12.0",
      "latest-status": "semver-safe-update"
    }]
  }));
  process.exit(0);
}
process.exit(1);
`,
    "utf8",
  );
  fs.chmodSync(composerPath, 0o755);
  fixture.config.composerPath = composerPath;

  return fixture;
}

function isCallToolResult(result: unknown): result is CallToolResult {
  return typeof result === "object" && result !== null && "content" in result;
}

function assertEnvelopeResult(result: unknown): ResourceOrToolResponse<Record<string, unknown>> {
  assert.ok(isCallToolResult(result), "expected an immediate tool result");
  if (!isCallToolResult(result)) {
    assert.fail("expected an immediate tool result");
  }
  const content = result.content.find((item) => item.type === "text");

  assert.ok(content?.text);
  const envelope = JSON.parse(content.text) as ResourceOrToolResponse<Record<string, unknown>>;
  assert.deepEqual(result.structuredContent, envelope);
  assert.equal(result.isError, envelope.status === "error" || envelope.status === "timeout");
  return envelope;
}

test("Task 5 input schemas enforce the MCP tool contracts", () => {
  assert.deepEqual(EmptyInput.parse({}), {});
  assert.throws(() => EmptyInput.parse({ unexpected: true }));

  assert.deepEqual(
    ScaffoldInput.parse({ machine_name: "acme_blog", target_type: "module" }),
    { machine_name: "acme_blog", target_type: "module" },
  );
  assert.throws(() => ScaffoldInput.parse({ machine_name: "AcmeBlog", target_type: "module" }));
  assert.throws(() => ScaffoldInput.parse({ machine_name: "../acme_blog", target_type: "module" }));
  assert.throws(() => ScaffoldInput.parse({ machine_name: "acme-blog", target_type: "module" }));
  assert.throws(() => ScaffoldInput.parse({ machine_name: "a".repeat(65), target_type: "module" }));
  assert.throws(() => ScaffoldInput.parse({ machine_name: "acme_blog", target_type: "theme" }));
  assert.throws(() => ScaffoldInput.parse({
    machine_name: "acme_blog",
    target_type: "module",
    unexpected: true,
  }));
});

test("registerReadOnlyTools lists exactly the seven read-only MCP tools", async () => {
  const { client, server } = await createConnectedClient(createState(null));

  try {
    const result = await client.listTools();
    assert.deepEqual(result.tools.map((tool) => tool.name), expectedToolNames);
  } finally {
    await closeClientAndServer(client, server);
  }
});

test("registerReadOnlyTools preserves envelopes for composer, upgrade, and scaffold calls", async () => {
  const fixture = createReadToolsFixture();
  const operations: OperationMeta[] = [];
  const state = createState(fixture.config);
  state.runOperation = async (meta, executor) => {
    operations.push(meta);
    return executor();
  };
  const { client, server } = await createConnectedClient(state);

  try {
    const composerInfo = assertEnvelopeResult(await client.callTool({
      name: "drift_composer_info",
      arguments: {},
    }));
    assert.equal(composerInfo.status, "ok");
    assert.equal(composerInfo.data?.manifest && (composerInfo.data.manifest as { name?: string }).name, "acme/site");

    const upgradeAssessment = assertEnvelopeResult(await client.callTool({
      name: "drift_upgrade_assessment",
      arguments: {},
    }));
    assert.equal(upgradeAssessment.status, "ok");
    assert.equal(upgradeAssessment.data?.total_outdated, 1);

    const scaffoldPlan = assertEnvelopeResult(await client.callTool({
      name: "drift_scaffold_plan",
      arguments: { machine_name: "acme_blog", target_type: "module" },
    }));
    assert.equal(scaffoldPlan.status, "ok");
    assert.equal(scaffoldPlan.data?.machine_name, "acme_blog");
    assert.equal(scaffoldPlan.data?.target_type, "module");

    assert.deepEqual(operations, [
      { name: "drift_composer_info", kind: "tool" },
      { name: "drift_upgrade_assessment", kind: "tool" },
      { name: "drift_scaffold_plan", kind: "tool" },
    ]);

    const invalidScaffold = await client.callTool({
      name: "drift_scaffold_plan",
      arguments: { machine_name: "AcmeBlog", target_type: "module" },
    });
    assert.equal(invalidScaffold.isError, true);
    assert.equal(operations.length, 3);
  } finally {
    await closeClientAndServer(client, server);
    fixture.cleanup();
  }
});
