import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  runCacheRebuildApply,
  runCacheRebuildPreview,
  runCacheRebuildVerify,
  runConfigExportApply,
  runConfigExportPreview,
  runConfigExportVerify,
  runModuleScaffoldApply,
  runModuleScaffoldPreview,
  runModuleScaffoldVerify,
} from "../features/workflows/index.js";
import type { ServerState } from "../types.js";
import { toMcpToolResult } from "./resultAdapter.js";
import {
  EmptyInput,
  PreviewTokenInput,
  ScaffoldApplyInput,
  ScaffoldInput,
} from "./toolSchemas.js";

export function registerWriteWorkflowTools(server: McpServer, state: ServerState): void {
  server.registerTool(
    "drift_cache_rebuild_preview",
    {
      description: "Preview a Drupal cache rebuild before applying it.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_cache_rebuild_preview", kind: "tool" },
        () => runCacheRebuildPreview(state),
      ),
    ),
  );
  server.registerTool(
    "drift_cache_rebuild_apply",
    {
      description: "Apply a previously previewed Drupal cache rebuild.",
      inputSchema: PreviewTokenInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_cache_rebuild_apply", kind: "tool" },
        () => runCacheRebuildApply(state, input),
      ),
    ),
  );
  server.registerTool(
    "drift_cache_rebuild_verify",
    {
      description: "Verify Drupal responsiveness after a cache rebuild.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_cache_rebuild_verify", kind: "tool" },
        () => runCacheRebuildVerify(state),
      ),
    ),
  );
  server.registerTool(
    "drift_module_scaffold_preview",
    {
      description: "Preview a Drupal module scaffold before applying it.",
      inputSchema: ScaffoldInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_module_scaffold_preview", kind: "tool" },
        () => runModuleScaffoldPreview(state, input),
      ),
    ),
  );
  server.registerTool(
    "drift_module_scaffold_apply",
    {
      description: "Apply a previously previewed Drupal module scaffold.",
      inputSchema: ScaffoldApplyInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_module_scaffold_apply", kind: "tool" },
        () => runModuleScaffoldApply(state, input),
      ),
    ),
  );
  server.registerTool(
    "drift_module_scaffold_verify",
    {
      description: "Verify files created by a Drupal module scaffold.",
      inputSchema: ScaffoldInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_module_scaffold_verify", kind: "tool" },
        () => runModuleScaffoldVerify(state, input),
      ),
    ),
  );
  server.registerTool(
    "drift_config_export_preview",
    {
      description: "Preview a Drupal configuration export before applying it.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_config_export_preview", kind: "tool" },
        () => runConfigExportPreview(state),
      ),
    ),
  );
  server.registerTool(
    "drift_config_export_apply",
    {
      description: "Apply a previously previewed Drupal configuration export.",
      inputSchema: PreviewTokenInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_config_export_apply", kind: "tool" },
        () => runConfigExportApply(state, input),
      ),
    ),
  );
  server.registerTool(
    "drift_config_export_verify",
    {
      description: "Verify a Drupal configuration export after applying it.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_config_export_verify", kind: "tool" },
        () => runConfigExportVerify(state),
      ),
    ),
  );
}
