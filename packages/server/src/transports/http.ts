import type { IncomingMessage, ServerResponse } from "node:http";
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

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

async function readRequestBody(
  req: IncomingMessage,
): Promise<{ ok: true; value: string } | { ok: false; code: string; message: string }> {
  return new Promise<{ ok: true; value: string } | { ok: false; code: string; message: string }>((resolve) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let tooLarge = false;

    req.on("data", (chunk: Buffer) => {
      if (tooLarge) {
        return;
      }
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        tooLarge = true;
        resolve({
          ok: false,
          code: "E_REQUEST_TOO_LARGE",
          message: "HTTP request body exceeds the maximum allowed size",
        });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (tooLarge) {
        return;
      }
      resolve({ ok: true, value: Buffer.concat(chunks).toString("utf8") });
    });

    req.on("error", () => {
      resolve({
        ok: false,
        code: "E_TRANSPORT_FAILURE",
        message: "HTTP transport encountered an unexpected error while reading the request body",
      });
    });
  });
}

function parseRequestJson(raw: string): { ok: true; value: unknown } | { ok: false; code: string; message: string } {
  if (raw.trim().length === 0) {
    return { ok: true, value: {} };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return {
      ok: false,
      code: "E_PARSE",
      message: "HTTP request body must be valid JSON",
    };
  }
}

async function handleRoute(req: IncomingMessage, res: ServerResponse, state: ServerState) {
  state.logger.info?.(`HTTP ${req.method} ${req.url}`);
  if (!req.url) {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  const parsedUrl = new URL(req.url, "http://localhost");
  const pathname = parsedUrl.pathname;
  const isApplyRoute =
    pathname === "/workflows/cache-rebuild/apply" ||
    pathname === "/workflows/scaffold/apply" ||
    pathname === "/workflows/config-export/apply";
  const isGetRoute = !isApplyRoute;

  if (req.headers.origin) {
    sendJson(res, 403, {
      status: "error",
      error: {
        code: "E_ORIGIN_REJECTED",
        message: "Cross-origin requests are not supported",
      },
    });
    return;
  }

  const remoteIp = req.socket.remoteAddress ?? "unknown";
  if (state.requestRateLimiter && !state.requestRateLimiter.isAllowed(remoteIp)) {
    sendJson(res, 429, {
      status: "error",
      error: {
        code: "E_RATE_LIMITED",
        message: "Rate limit exceeded for this client IP",
      },
    });
    return;
  }

  if ((req.method === "GET" && isApplyRoute) || (req.method === "POST" && isGetRoute)) {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  switch (pathname) {
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
            binaries: state.binaryValidation,
            capabilities: {
              local_only: state.httpHost === "127.0.0.1" || state.httpHost === "::1",
              redaction_enabled: Boolean(state.config?.redaction?.enabled),
              rate_limiting_enabled: Boolean(state.requestRateLimiter),
              write_disabled: false,
            },
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
    case "/project-modules": {
      const response = await state.runOperation(
        { name: "project_modules", kind: "resource" },
        () => getProjectModules(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/project-config-layout": {
      const response = await state.runOperation(
        { name: "project_config_layout", kind: "resource" },
        () => getProjectConfigLayout(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/project-checks": {
      const response = await state.runOperation(
        { name: "project_checks", kind: "resource" },
        () => getProjectChecks(state),
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
    case "/workflows/upgrade-assessment": {
      const response = await state.runOperation(
        { name: "upgrade_assessment", kind: "tool" },
        () => runUpgradeAssessment(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/config-drift": {
      const response = await state.runOperation(
        { name: "config_drift_assessment", kind: "tool" },
        () => runConfigDriftAssessment(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/cache-rebuild/preview": {
      const response = await state.runOperation(
        { name: "cache_rebuild_preview", kind: "tool" },
        () => runCacheRebuildPreview(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/cache-rebuild/apply": {
      const rawBody = await readRequestBody(req);
      if (!rawBody.ok) {
        sendJson(res, rawBody.code === "E_REQUEST_TOO_LARGE" ? 413 : 500, {
          status: "error",
          error: {
            code: rawBody.code,
            message: rawBody.message,
          },
        });
        return;
      }

      const bodyResult = parseRequestJson(rawBody.value);
      if (!bodyResult.ok) {
        sendJson(res, bodyResult.code === "E_REQUEST_TOO_LARGE" ? 413 : 400, {
          status: "error",
          error: {
            code: bodyResult.code,
            message: bodyResult.message,
          },
        });
        return;
      }

      const response = await state.runOperation(
        { name: "cache_rebuild_apply", kind: "tool" },
        () => runCacheRebuildApply(state, bodyResult.value as { preview_token?: string }),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/cache-rebuild/verify": {
      const response = await state.runOperation(
        { name: "cache_rebuild_verify", kind: "tool" },
        () => runCacheRebuildVerify(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/scaffold/preview": {
      const parsedInput = parseModuleScaffoldInput({
        machine_name: parsedUrl.searchParams.get("machine_name") ?? undefined,
        target_type: parsedUrl.searchParams.get("target_type") ?? undefined,
      });

      if (!parsedInput.ok) {
        sendJson(res, 200, parsedInput.response);
        return;
      }

      const response = await state.runOperation(
        { name: "module_scaffold_preview", kind: "tool" },
        () => runModuleScaffoldPreview(state, parsedInput.value),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/scaffold/apply": {
      const rawBody = await readRequestBody(req);
      if (!rawBody.ok) {
        sendJson(res, rawBody.code === "E_REQUEST_TOO_LARGE" ? 413 : 500, {
          status: "error",
          error: {
            code: rawBody.code,
            message: rawBody.message,
          },
        });
        return;
      }

      const bodyResult = parseRequestJson(rawBody.value);
      if (!bodyResult.ok) {
        sendJson(res, bodyResult.code === "E_REQUEST_TOO_LARGE" ? 413 : 400, {
          status: "error",
          error: {
            code: bodyResult.code,
            message: bodyResult.message,
          },
        });
        return;
      }

      const response = await state.runOperation(
        { name: "module_scaffold_apply", kind: "tool" },
        () => runModuleScaffoldApply(state, bodyResult.value as { machine_name?: string; target_type?: string; preview_token?: string }),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/scaffold/verify": {
      const parsedInput = parseModuleScaffoldInput({
        machine_name: parsedUrl.searchParams.get("machine_name") ?? undefined,
        target_type: parsedUrl.searchParams.get("target_type") ?? undefined,
      });

      if (!parsedInput.ok) {
        sendJson(res, 200, parsedInput.response);
        return;
      }

      const response = await state.runOperation(
        { name: "module_scaffold_verify", kind: "tool" },
        () => runModuleScaffoldVerify(state, parsedInput.value),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/config-export/preview": {
      const response = await state.runOperation(
        { name: "config_export_preview", kind: "tool" },
        () => runConfigExportPreview(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/config-export/apply": {
      const rawBody = await readRequestBody(req);
      if (!rawBody.ok) {
        sendJson(res, rawBody.code === "E_REQUEST_TOO_LARGE" ? 413 : 500, {
          status: "error",
          error: {
            code: rawBody.code,
            message: rawBody.message,
          },
        });
        return;
      }

      const bodyResult = parseRequestJson(rawBody.value);
      if (!bodyResult.ok) {
        sendJson(res, bodyResult.code === "E_REQUEST_TOO_LARGE" ? 413 : 400, {
          status: "error",
          error: {
            code: bodyResult.code,
            message: bodyResult.message,
          },
        });
        return;
      }

      const response = await state.runOperation(
        { name: "config_export_apply", kind: "tool" },
        () => runConfigExportApply(state, bodyResult.value as { preview_token?: string }),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/config-export/verify": {
      const response = await state.runOperation(
        { name: "config_export_verify", kind: "tool" },
        () => runConfigExportVerify(state),
      );
      sendJson(res, 200, response);
      return;
    }
    case "/workflows/scaffold-plan": {
      const parsedInput = parseScaffoldPlanInput({
        machine_name: parsedUrl.searchParams.get("machine_name") ?? undefined,
        target_type: parsedUrl.searchParams.get("target_type") ?? undefined,
      });

      if (!parsedInput.ok) {
        sendJson(res, 200, parsedInput.response);
        return;
      }

      const response = await state.runOperation(
        { name: "scaffold_plan", kind: "tool" },
        () => runScaffoldPlanning(state, parsedInput.value),
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
      },
    });
  });
}
