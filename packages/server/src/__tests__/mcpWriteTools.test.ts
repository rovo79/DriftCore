import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { clearPreviewTokensForTests } from "../features/writeLifecycle.js";
import { registerWriteWorkflowTools } from "../mcp/writeTools.js";
import {
  PreviewTokenInput,
  ScaffoldApplyInput,
} from "../mcp/toolSchemas.js";
import { createState } from "./testUtils.js";
import { createWriteFixture } from "./writeTestUtils.js";
import type { OperationMeta, ResourceOrToolResponse, ServerState } from "../types.js";

const expectedToolNames = [
  "drift_cache_rebuild_preview",
  "drift_cache_rebuild_apply",
  "drift_cache_rebuild_verify",
  "drift_module_scaffold_preview",
  "drift_module_scaffold_apply",
  "drift_module_scaffold_verify",
  "drift_config_export_preview",
  "drift_config_export_apply",
  "drift_config_export_verify",
];

async function createConnectedClient(state: ServerState) {
  const server = new McpServer({ name: "driftcore-write-tools-test", version: "0.1.0" });
  registerWriteWorkflowTools(server, state);

  const client = new Client({ name: "driftcore-write-tools-client", version: "0.1.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

async function closeClientAndServer(client: Client, server: McpServer) {
  await client.close();
  await server.close();
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

function requirePreviewToken(envelope: ResourceOrToolResponse<Record<string, unknown>>): string {
  const token = envelope.data?.preview_token;

  assert.equal(typeof token, "string");
  if (typeof token !== "string") {
    assert.fail("expected a preview token");
  }
  assert.ok(token.length > 0);
  return token;
}

async function assertSchemaRejected(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await client.callTool({ name, arguments: args });

  assert.ok(isCallToolResult(result));
  if (!isCallToolResult(result)) {
    assert.fail("expected an immediate tool result");
  }
  assert.equal(result.isError, true);
}

async function assertInputValidationRejected(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await client.callTool({ name, arguments: args });

  assert.ok(isCallToolResult(result));
  if (!isCallToolResult(result)) {
    assert.fail("expected an immediate tool result");
  }
  assert.equal(result.isError, true);
  const content = result.content.find((item) => item.type === "text");
  assert.ok(content?.text);
  assert.match(content.text, /Input validation error/);
}

test("Task 6 input schemas enforce guarded workflow contracts", () => {
  assert.deepEqual(PreviewTokenInput.parse({ preview_token: "token-value" }), {
    preview_token: "token-value",
  });
  assert.throws(() => PreviewTokenInput.parse({}));
  assert.throws(() => PreviewTokenInput.parse({ preview_token: "" }));
  assert.throws(() => PreviewTokenInput.parse({ preview_token: "token-value", unexpected: true }));

  assert.deepEqual(
    ScaffoldApplyInput.parse({
      machine_name: "acme_blog",
      target_type: "module",
      preview_token: "token-value",
    }),
    {
      machine_name: "acme_blog",
      target_type: "module",
      preview_token: "token-value",
    },
  );
  assert.throws(() => ScaffoldApplyInput.parse({ machine_name: "acme_blog", target_type: "module" }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "acme_blog",
    target_type: "module",
    preview_token: "",
  }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "AcmeBlog",
    target_type: "module",
    preview_token: "token-value",
  }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "../acme_blog",
    target_type: "module",
    preview_token: "token-value",
  }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "acme-blog",
    target_type: "module",
    preview_token: "token-value",
  }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "acme_blog",
    target_type: "theme",
    preview_token: "token-value",
  }));
  assert.throws(() => ScaffoldApplyInput.parse({
    machine_name: "acme_blog",
    target_type: "module",
    preview_token: "token-value",
    unexpected: true,
  }));
});

test("registerWriteWorkflowTools lists exactly the guarded workflow tools", async () => {
  const { client, server } = await createConnectedClient(createState(null));

  try {
    const result = await client.listTools();
    assert.deepEqual(result.tools.map((tool) => tool.name), expectedToolNames);
  } finally {
    await closeClientAndServer(client, server);
  }
});

test("registerWriteWorkflowTools validates scaffold identity before verification", async () => {
  const { client, server } = await createConnectedClient(createState(null));

  try {
    await assertInputValidationRejected(client, "drift_module_scaffold_verify", {});
    await assertInputValidationRejected(client, "drift_module_scaffold_verify", {
      machine_name: "AcmeBlog",
      target_type: "module",
    });
  } finally {
    await closeClientAndServer(client, server);
  }
});

test("registerWriteWorkflowTools preserves guarded lifecycle behavior through MCP", async () => {
  clearPreviewTokensForTests();
  const fixture = createWriteFixture();
  const operations: OperationMeta[] = [];
  const state = createState(fixture.config);
  state.runOperation = async (meta, executor) => {
    operations.push(meta);
    return executor();
  };
  const { client, server } = await createConnectedClient(state);

  try {
    const cachePreview = assertEnvelopeResult(await client.callTool({
      name: "drift_cache_rebuild_preview",
      arguments: {},
    }));
    assert.equal(cachePreview.status, "ok");
    const cacheToken = requirePreviewToken(cachePreview);

    const crossWorkflowApply = assertEnvelopeResult(await client.callTool({
      name: "drift_config_export_apply",
      arguments: { preview_token: cacheToken },
    }));
    assert.equal(crossWorkflowApply.status, "error");
    assert.equal(crossWorkflowApply.error?.code, "E_PREVIEW_REQUIRED");

    const cacheApply = assertEnvelopeResult(await client.callTool({
      name: "drift_cache_rebuild_apply",
      arguments: { preview_token: cacheToken },
    }));
    assert.equal(cacheApply.status, "ok");
    assert.ok(Array.isArray(cacheApply.data?.changes));

    const cacheReuse = assertEnvelopeResult(await client.callTool({
      name: "drift_cache_rebuild_apply",
      arguments: { preview_token: cacheToken },
    }));
    assert.equal(cacheReuse.status, "error");
    assert.equal(cacheReuse.error?.code, "E_PREVIEW_CONSUMED");

    const cacheVerify = assertEnvelopeResult(await client.callTool({
      name: "drift_cache_rebuild_verify",
      arguments: {},
    }));
    assert.equal(cacheVerify.status, "ok");
    assert.equal(cacheVerify.data?.verified, true);

    const scaffoldInput = { machine_name: "acme_blog", target_type: "module" as const };
    const scaffoldPreview = assertEnvelopeResult(await client.callTool({
      name: "drift_module_scaffold_preview",
      arguments: scaffoldInput,
    }));
    assert.equal(scaffoldPreview.status, "ok");
    const scaffoldToken = requirePreviewToken(scaffoldPreview);

    const scaffoldApply = assertEnvelopeResult(await client.callTool({
      name: "drift_module_scaffold_apply",
      arguments: { ...scaffoldInput, preview_token: scaffoldToken },
    }));
    assert.equal(scaffoldApply.status, "ok");
    assert.equal(
      fs.existsSync(path.join(fixture.projectRoot, "web", "modules", "custom", "acme_blog", "acme_blog.info.yml")),
      true,
    );

    const scaffoldVerify = assertEnvelopeResult(await client.callTool({
      name: "drift_module_scaffold_verify",
      arguments: scaffoldInput,
    }));
    assert.equal(scaffoldVerify.status, "ok");
    assert.equal(scaffoldVerify.data?.verified, true);

    fs.rmSync(path.join(fixture.projectRoot, "web", "modules", "custom", "acme_blog"), {
      recursive: true,
      force: true,
    });
    const scaffoldReuse = assertEnvelopeResult(await client.callTool({
      name: "drift_module_scaffold_apply",
      arguments: { ...scaffoldInput, preview_token: scaffoldToken },
    }));
    assert.equal(scaffoldReuse.status, "error");
    assert.equal(scaffoldReuse.error?.code, "E_PREVIEW_CONSUMED");

    const exportPreview = assertEnvelopeResult(await client.callTool({
      name: "drift_config_export_preview",
      arguments: {},
    }));
    assert.equal(exportPreview.status, "ok");
    const exportToken = requirePreviewToken(exportPreview);

    const exportApply = assertEnvelopeResult(await client.callTool({
      name: "drift_config_export_apply",
      arguments: { preview_token: exportToken },
    }));
    assert.equal(exportApply.status, "ok");
    assert.equal(fs.readFileSync(path.join(fixture.syncDirectory, "system.site.yml"), "utf8"), "name: Exported\n");

    const exportReuse = assertEnvelopeResult(await client.callTool({
      name: "drift_config_export_apply",
      arguments: { preview_token: exportToken },
    }));
    assert.equal(exportReuse.status, "error");
    assert.equal(exportReuse.error?.code, "E_PREVIEW_CONSUMED");

    const exportVerify = assertEnvelopeResult(await client.callTool({
      name: "drift_config_export_verify",
      arguments: {},
    }));
    assert.equal(exportVerify.status, "ok");
    assert.equal(exportVerify.data?.verified, true);

    await assertSchemaRejected(client, "drift_cache_rebuild_apply", {});
    await assertSchemaRejected(client, "drift_cache_rebuild_apply", { preview_token: "" });
    await assertSchemaRejected(client, "drift_module_scaffold_apply", scaffoldInput);
    await assertSchemaRejected(client, "drift_module_scaffold_apply", {
      ...scaffoldInput,
      preview_token: "",
    });
    await assertSchemaRejected(client, "drift_config_export_apply", {});
    await assertSchemaRejected(client, "drift_config_export_apply", { preview_token: "" });

    assert.ok(operations.every((operation) => operation.kind === "tool"));
    for (const name of expectedToolNames) {
      assert.ok(operations.some((operation) => operation.name === name));
    }
  } finally {
    await closeClientAndServer(client, server);
    fixture.cleanup();
    clearPreviewTokensForTests();
  }
});

test("registerWriteWorkflowTools keeps not_configured results non-error", async () => {
  const { client, server } = await createConnectedClient(createState(null));

  try {
    const result = assertEnvelopeResult(await client.callTool({
      name: "drift_cache_rebuild_preview",
      arguments: {},
    }));
    assert.equal(result.status, "not_configured");
  } finally {
    await closeClientAndServer(client, server);
  }
});
