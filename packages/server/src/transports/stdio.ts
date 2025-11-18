import type { Interface } from "node:readline";
import type { ServerState } from "../types.js";
import { getProjectManifest } from "../features/projectManifest.js";
import { runDrushStatus, runDrushPml } from "../features/drushTools.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";

interface StdioRequest {
  id?: string | number;
  action: string;
}

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
            details: { message: (error as Error).message },
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
