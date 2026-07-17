import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";
import { runDrushPml, runDrushStatus } from "../features/drushTools.js";
import {
  runConfigDriftAssessment,
  runScaffoldPlanning,
  runUpgradeAssessment,
} from "../features/workflows/index.js";
import type { ServerState } from "../types.js";
import { toMcpToolResult } from "./resultAdapter.js";
import { EmptyInput, ScaffoldInput } from "./toolSchemas.js";

export function registerReadOnlyTools(server: McpServer, state: ServerState): void {
  server.registerTool(
    "drift_drush_status",
    {
      description: "Inspect the configured Drupal site status through Drush.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_drush_status", kind: "tool" },
        () => runDrushStatus(state),
      ),
    ),
  );
  server.registerTool(
    "drift_drush_pml",
    {
      description: "List configured Drupal modules and themes through Drush.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_drush_pml", kind: "tool" },
        () => runDrushPml(state),
      ),
    ),
  );
  server.registerTool(
    "drift_composer_info",
    {
      description: "Read the Composer manifest and lock summary.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_composer_info", kind: "tool" },
        () => runComposerInfo(state),
      ),
    ),
  );
  server.registerTool(
    "drift_composer_outdated",
    {
      description: "Inspect Composer dependency updates.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_composer_outdated", kind: "tool" },
        () => runComposerOutdated(state),
      ),
    ),
  );
  server.registerTool(
    "drift_upgrade_assessment",
    {
      description: "Assess Drupal and Composer upgrade candidates.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_upgrade_assessment", kind: "tool" },
        () => runUpgradeAssessment(state),
      ),
    ),
  );
  server.registerTool(
    "drift_config_drift_assessment",
    {
      description: "Assess pending Drupal configuration drift.",
      inputSchema: EmptyInput,
    },
    async () => toMcpToolResult(
      await state.runOperation(
        { name: "drift_config_drift_assessment", kind: "tool" },
        () => runConfigDriftAssessment(state),
      ),
    ),
  );
  server.registerTool(
    "drift_scaffold_plan",
    {
      description: "Build a read-only Drupal module scaffold plan.",
      inputSchema: ScaffoldInput,
    },
    async (input) => toMcpToolResult(
      await state.runOperation(
        { name: "drift_scaffold_plan", kind: "tool" },
        () => runScaffoldPlanning(state, input),
      ),
    ),
  );
}
