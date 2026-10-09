import assert from "node:assert/strict";
import test from "node:test";
import { toMcpToolResult } from "../mcp/resultAdapter.js";
import type { ResourceOrToolResponse } from "../types.js";

function assertTextRoundTrips(response: ResourceOrToolResponse<unknown>) {
  const result = toMcpToolResult(response);
  const content = result.content[0];

  assert.ok(content);
  assert.equal(content.type, "text");
  if (content.type !== "text") {
    assert.fail("expected text content");
  }

  assert.deepEqual(JSON.parse(content.text), response);
  assert.deepEqual(result.structuredContent, response);
  return result;
}

test("toMcpToolResult keeps ok responses as successful MCP results", () => {
  const result = assertTextRoundTrips({ status: "ok", data: { ready: true } });

  assert.equal(result.isError, false);
});

test("toMcpToolResult keeps degraded responses as successful MCP results", () => {
  const result = assertTextRoundTrips({
    status: "degraded",
    data: { source: "filesystem" },
  });

  assert.equal(result.isError, false);
});

test("toMcpToolResult marks domain error responses as MCP errors", () => {
  const result = assertTextRoundTrips({
    status: "error",
    error: { code: "E_TEST", message: "failure" },
  });

  assert.equal(result.isError, true);
});

test("toMcpToolResult marks timeout responses as MCP errors", () => {
  const result = assertTextRoundTrips({
    status: "timeout",
    error: { code: "E_TIMEOUT", message: "timed out" },
  });

  assert.equal(result.isError, true);
});

test("toMcpToolResult keeps not_configured responses as successful MCP results", () => {
  const result = assertTextRoundTrips({
    status: "not_configured",
    error: { code: "E_CONFIG", message: "configuration is missing" },
  });

  assert.equal(result.isError, false);
});
