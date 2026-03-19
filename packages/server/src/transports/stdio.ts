import type { Interface } from "node:readline";
import type { ServerState } from "../types.js";
import { getProjectChecks } from "../features/projectChecks.js";
import { getProjectConfigLayout } from "../features/projectConfigLayout.js";
import { getProjectManifest } from "../features/projectManifest.js";
import { getProjectModules } from "../features/projectModules.js";
import { runDrushStatus, runDrushPml } from "../features/drushTools.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";
import { runConfigDriftAssessment } from "../features/workflows/configDriftAssessment.js";
import {
  parseModuleScaffoldInput,
  parseScaffoldPlanInput,
  runCacheRebuildApply,
  runCacheRebuildPreview,
  runCacheRebuildVerify,
  runConfigExportApply,
  runConfigExportPreview,
  runConfigExportVerify,
  runModuleScaffoldApply,
  runModuleScaffoldPreview,
  runModuleScaffoldVerify,
  runScaffoldPlanning,
  runUpgradeAssessment,
} from "../features/workflows/index.js";

interface StdioRequest {
  id?: string | number;
  action: string;
  params?: unknown;
}

const MAX_STDIO_LINE_LENGTH = 1048576;

export async function stdioTransport(rl: Interface, state: ServerState) {
  state.logger.info?.("Starting MCP STDIO transport");

  const handleRequest = async (request: StdioRequest) => {
    switch (request.action) {
      case "resources":
        return state.runOperation(
          { name: "stdio_resources", kind: "transport" },
          () => ({ resources: state.resources }),
        );
      case "tools":
        return state.runOperation(
          { name: "stdio_tools", kind: "transport" },
          () => ({ tools: state.tools }),
        );
      case "project_manifest":
        return state.runOperation(
          { name: "project_manifest", kind: "resource" },
          () => getProjectManifest(state),
        );
      case "project_modules":
        return state.runOperation(
          { name: "project_modules", kind: "resource" },
          () => getProjectModules(state),
        );
      case "project_config_layout":
        return state.runOperation(
          { name: "project_config_layout", kind: "resource" },
          () => getProjectConfigLayout(state),
        );
      case "project_checks":
        return state.runOperation(
          { name: "project_checks", kind: "resource" },
          () => getProjectChecks(state),
        );
      case "drush_status":
        return state.runOperation(
          { name: "drush_status", kind: "tool" },
          () => runDrushStatus(state),
        );
      case "drush_pml":
        return state.runOperation(
          { name: "drush_pml", kind: "tool" },
          () => runDrushPml(state),
        );
      case "composer_info":
        return state.runOperation(
          { name: "composer_info", kind: "tool" },
          () => runComposerInfo(state),
        );
      case "composer_outdated":
        return state.runOperation(
          { name: "composer_outdated", kind: "tool" },
          () => runComposerOutdated(state),
        );
      case "upgrade_assessment":
        return state.runOperation(
          { name: "upgrade_assessment", kind: "tool" },
          () => runUpgradeAssessment(state),
        );
      case "config_drift_assessment":
        return state.runOperation(
          { name: "config_drift_assessment", kind: "tool" },
          () => runConfigDriftAssessment(state),
        );
      case "cache_rebuild_preview":
        return state.runOperation(
          { name: "cache_rebuild_preview", kind: "tool" },
          () => runCacheRebuildPreview(state),
        );
      case "cache_rebuild_apply":
        return state.runOperation(
          { name: "cache_rebuild_apply", kind: "tool" },
          () => runCacheRebuildApply(state, request.params as { preview_token?: string }),
        );
      case "cache_rebuild_verify":
        return state.runOperation(
          { name: "cache_rebuild_verify", kind: "tool" },
          () => runCacheRebuildVerify(state),
        );
      case "scaffold_preview": {
        const parsedInput = parseModuleScaffoldInput(request.params);
        if (!parsedInput.ok) {
          return parsedInput.response;
        }

        return state.runOperation(
          { name: "module_scaffold_preview", kind: "tool" },
          () => runModuleScaffoldPreview(state, parsedInput.value),
        );
      }
      case "scaffold_apply":
        return state.runOperation(
          { name: "module_scaffold_apply", kind: "tool" },
          () => runModuleScaffoldApply(state, request.params as { machine_name?: string; target_type?: string; preview_token?: string }),
        );
      case "scaffold_verify": {
        const parsedInput = parseModuleScaffoldInput(request.params);
        if (!parsedInput.ok) {
          return parsedInput.response;
        }

        return state.runOperation(
          { name: "module_scaffold_verify", kind: "tool" },
          () => runModuleScaffoldVerify(state, parsedInput.value),
        );
      }
      case "config_export_preview":
        return state.runOperation(
          { name: "config_export_preview", kind: "tool" },
          () => runConfigExportPreview(state),
        );
      case "config_export_apply":
        return state.runOperation(
          { name: "config_export_apply", kind: "tool" },
          () => runConfigExportApply(state, request.params as { preview_token?: string }),
        );
      case "config_export_verify":
        return state.runOperation(
          { name: "config_export_verify", kind: "tool" },
          () => runConfigExportVerify(state),
        );
      case "scaffold_plan": {
        const parsedInput = parseScaffoldPlanInput(request.params);
        if (!parsedInput.ok) {
          return parsedInput.response;
        }

        return state.runOperation(
          { name: "scaffold_plan", kind: "tool" },
          () => runScaffoldPlanning(state, parsedInput.value),
        );
      }
      default:
        return {
          status: "error",
          error: {
            code: "E_UNKNOWN_ACTION",
            message: `Unknown stdio action: ${request.action}`,
          },
        };
    }
  };

  rl.on("line", (line) => {
    (async () => {
      if (Buffer.byteLength(line, "utf8") > MAX_STDIO_LINE_LENGTH) {
        rl.write(
          JSON.stringify({
            status: "error",
            error: {
              code: "E_INPUT_TOO_LARGE",
              message: "STDIO input line exceeds the maximum allowed size",
            },
          }) + "\n",
        );
        return;
      }

      let parsed: StdioRequest;
      try {
        parsed = JSON.parse(line) as StdioRequest;
      } catch {
        rl.write(
          JSON.stringify({
            status: "error",
            error: { code: "E_PARSE", message: "STDIO input must be JSON" },
          }) + "\n",
        );
        return;
      }

      const response = await handleRequest(parsed);
      rl.write(
        JSON.stringify({
          id: parsed.id,
          action: parsed.action,
          response,
        }) + "\n",
      );
    })().catch((error) => {
      rl.write(
        JSON.stringify({
          status: "error",
          error: {
            code: "E_TRANSPORT_FAILURE",
            message: "STDIO transport encountered an unexpected error",
          },
        }) + "\n",
      );
    });
  });

  return new Promise<void>((resolve) => {
    rl.on("close", () => {
      state.logger.info?.("STDIO transport closed");
      resolve();
    });
  });
}
