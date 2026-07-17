import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProjectChecks } from "../features/projectChecks.js";
import { getProjectConfigLayout } from "../features/projectConfigLayout.js";
import { getProjectManifest } from "../features/projectManifest.js";
import { getProjectModules } from "../features/projectModules.js";
import type { ResourceOrToolResponse, ServerState } from "../types.js";

export const DRIFTCORE_RESOURCE_URIS = [
  "driftcore://project/manifest",
  "driftcore://project/modules",
  "driftcore://project/config-layout",
  "driftcore://project/checks",
] as const;

function toMcpResourceResponse(uri: URL, response: ResourceOrToolResponse<unknown>) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export function registerDriftCoreResources(server: McpServer, state: ServerState): void {
  server.registerResource(
    "project_manifest",
    DRIFTCORE_RESOURCE_URIS[0],
    { mimeType: "application/json" },
    async (uri) => toMcpResourceResponse(
      uri,
      await state.runOperation(
        { name: "project_manifest", kind: "resource" },
        () => getProjectManifest(state),
      ),
    ),
  );
  server.registerResource(
    "project_modules",
    DRIFTCORE_RESOURCE_URIS[1],
    { mimeType: "application/json" },
    async (uri) => toMcpResourceResponse(
      uri,
      await state.runOperation(
        { name: "project_modules", kind: "resource" },
        () => getProjectModules(state),
      ),
    ),
  );
  server.registerResource(
    "project_config_layout",
    DRIFTCORE_RESOURCE_URIS[2],
    { mimeType: "application/json" },
    async (uri) => toMcpResourceResponse(
      uri,
      await state.runOperation(
        { name: "project_config_layout", kind: "resource" },
        () => getProjectConfigLayout(state),
      ),
    ),
  );
  server.registerResource(
    "project_checks",
    DRIFTCORE_RESOURCE_URIS[3],
    { mimeType: "application/json" },
    async (uri) => toMcpResourceResponse(
      uri,
      await state.runOperation(
        { name: "project_checks", kind: "resource" },
        () => getProjectChecks(state),
      ),
    ),
  );
}
