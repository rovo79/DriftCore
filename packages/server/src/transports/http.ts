import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerState } from "../types.js";
import { getProjectManifest } from "../features/projectManifest.js";
import { runDrushStatus, runDrushPml } from "../features/drushTools.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

async function handleRoute(req: IncomingMessage, res: ServerResponse, state: ServerState) {
  state.logger.info?.(`HTTP ${req.method} ${req.url}`);
  if (req.method !== "GET" || !req.url) {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  switch (req.url) {
    case "/health":
      sendJson(
        res,
        200,
        await state.runOperation(
          { name: "health", kind: "transport" },
          () => ({
            status: "ok",
            configured: Boolean(state.config),
            tools: state.tools.length,
            resources: state.resources.length,
          }),
        ),
      );
      return;
    case "/resources":
      sendJson(
        res,
        200,
        await state.runOperation(
          { name: "list_resources", kind: "transport" },
          () => ({ resources: state.resources }),
        ),
      );
      return;
    case "/tools":
      sendJson(
        res,
        200,
        await state.runOperation(
          { name: "list_tools", kind: "transport" },
          () => ({ tools: state.tools }),
        ),
      );
      return;
    case "/project-manifest": {
      const response = await state.runOperation(
        { name: "project_manifest", kind: "resource" },
        () => getProjectManifest(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/drush/status": {
      const response = await state.runOperation(
        { name: "drush_status", kind: "tool" },
        () => runDrushStatus(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/drush/pml": {
      const response = await state.runOperation(
        { name: "drush_pml", kind: "tool" },
        () => runDrushPml(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/composer/info": {
      const response = await state.runOperation(
        { name: "composer_info", kind: "tool" },
        () => runComposerInfo(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/composer/outdated": {
      const response = await state.runOperation(
        { name: "composer_outdated", kind: "tool" },
        () => runComposerOutdated(state),
      );
      sendJson(res, 200, response);
      return;
    }
    default:
      sendJson(res, 404, { error: "Not Found" });
  }
}

export function httpTransport(
  req: IncomingMessage,
  res: ServerResponse,
  state: ServerState,
) {
  handleRoute(req, res, state).catch((error) => {
    state.logger.error?.("HTTP transport error", error);
    sendJson(res, 500, {
      status: "error",
      error: {
        code: "E_TRANSPORT_FAILURE",
        message: "HTTP transport encountered an unexpected error",
        details: { message: (error as Error).message },
      },
    });
  });
}
