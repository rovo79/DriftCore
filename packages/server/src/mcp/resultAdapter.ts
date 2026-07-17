import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ResourceOrToolResponse } from "../types.js";

function toStructuredContent(response: ResourceOrToolResponse<unknown>): Record<string, unknown> {
  const structuredContent: Record<string, unknown> = { status: response.status };

  if (response.data !== undefined) {
    structuredContent.data = response.data;
  }
  if (response.error !== undefined) {
    structuredContent.error = response.error;
  }

  return structuredContent;
}

export function toMcpToolResult(
  response: ResourceOrToolResponse<unknown>,
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2),
      },
    ],
    structuredContent: toStructuredContent(response),
    isError: response.status === "error" || response.status === "timeout",
  };
}
