import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DRIFTCORE_RESOURCE_URIS,
  registerDriftCoreResources,
} from "../mcp/resources.js";
import { createState } from "./testUtils.js";
import type { OperationMeta, ServerState } from "../types.js";

const expectedResources = [
  { name: "project_manifest", uri: "driftcore://project/manifest" },
  { name: "project_modules", uri: "driftcore://project/modules" },
  { name: "project_config_layout", uri: "driftcore://project/config-layout" },
  { name: "project_checks", uri: "driftcore://project/checks" },
];

async function createConnectedClient(state: ServerState) {
  const server = new McpServer({ name: "driftcore-resource-test", version: "0.1.0" });
  registerDriftCoreResources(server, state);

  const client = new Client({ name: "driftcore-resource-client", version: "0.1.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

async function closeClientAndServer(
  client: Client,
  server: McpServer,
) {
  await client.close();
  await server.close();
}

test("registerDriftCoreResources lists exactly the authoritative project resources", async () => {
  const { client, server } = await createConnectedClient(createState(null));

  try {
    const result = await client.listResources();
    const resources = result.resources.map((resource) => ({
      name: resource.name,
      uri: resource.uri,
    }));

    assert.deepEqual(resources, expectedResources);
    assert.equal(resources.some((resource) => resource.name === "schema.entityTypes"), false);
    assert.equal(resources.some((resource) => resource.name === "config.exported"), false);
    assert.deepEqual(DRIFTCORE_RESOURCE_URIS, expectedResources.map((resource) => resource.uri));
  } finally {
    await closeClientAndServer(client, server);
  }
});

test("registerDriftCoreResources reads every resource through the operation wrapper", async () => {
  const operations: OperationMeta[] = [];
  const state = createState(null);
  state.runOperation = async (meta, executor) => {
    operations.push(meta);
    return executor();
  };
  const { client, server } = await createConnectedClient(state);

  try {
    for (const uri of DRIFTCORE_RESOURCE_URIS) {
      const result = await client.readResource({ uri });
      const content = result.contents[0];

      assert.ok(content);
      assert.equal(content.mimeType, "application/json");
      assert.ok("text" in content);
      if (!("text" in content)) {
        assert.fail("expected text resource content");
      }
      assert.ok(JSON.parse(content.text));
    }

    assert.deepEqual(
      operations.map((operation) => operation.name),
      ["project_manifest", "project_modules", "project_config_layout", "project_checks"],
    );
    assert.ok(operations.every((operation) => operation.kind === "resource"));
  } finally {
    await closeClientAndServer(client, server);
  }
});
