import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { expectedResources, expectedTools, runPackedMcpSmoke } from "./packedMcpSmoke.js";

const execute = promisify(execFile);
const inspector = process.argv[2];
assert.ok(inspector && path.isAbsolute(inspector), "Pass the absolute path to Inspector 2.10.1's mcp-inspector executable");
fs.accessSync(inspector, fs.constants.X_OK);

// Inspector remains an external acceptance tool, not a server dependency.
runPackedMcpSmoke(async (executable, projectRoot, cwd) => {
  fs.mkdirSync(path.join(projectRoot, "config", "sync"), { recursive: true });
  const configPath = path.join(cwd, "inspector.json");
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { driftcore: {
    command: executable, args: ["--project-root", projectRoot],
  } } }));
  const before = fs.readFileSync(path.join(projectRoot, "composer.json"), "utf8");
  async function invoke(method: string, extra: string[] = []): Promise<Record<string, unknown>> {
    const args = ["--cli", "--config", configPath, "--server", "driftcore",
      "--format", "json", "--method", method, ...extra];
    const { stdout } = await execute(inspector, args, { cwd, timeout: 45000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, MCP_INSPECTOR_SECRET_STORE: "memory" } });
    const result: unknown = JSON.parse(stdout);
    assert.ok(result && typeof result === "object" && !Array.isArray(result));
    const payload = (result as Record<string, unknown>).result;
    assert.ok(payload && typeof payload === "object" && !Array.isArray(payload));
    return payload as Record<string, unknown>;
  }
  const resources = await invoke("resources/list");
  assert.ok(Array.isArray(resources.resources), JSON.stringify(resources));
  assert.deepEqual((resources.resources as Array<{ uri: string }>).map((item) => item.uri).sort(), expectedResources);
  const tools = await invoke("tools/list");
  assert.deepEqual((tools.tools as Array<{ name: string }>).map((item) => item.name).sort(), expectedTools);
  for (const uri of expectedResources) {
    const result = await invoke("resources/read", ["--uri", uri]);
    const contents = result.contents as Array<{ text: string }>;
    assert.equal(contents.length, 1);
    const envelope = JSON.parse(contents[0].text);
    assert.ok(["ok", "degraded"].includes(envelope.status), `${uri}: ${envelope.status}`);
    if (uri.endsWith("/manifest")) assert.equal(envelope.data.project_root, projectRoot);
    console.info(`Inspector ${uri}: ${envelope.status}`);
  }
  const assessment = await invoke("tools/call", ["--tool-name", "drift_upgrade_assessment"]);
  const assessmentEnvelope = assessment.structuredContent as { status: string };
  // No Composer binary is installed in this fixture. Preserve and report the
  // honest degraded result rather than fake a successful real-site assessment.
  assert.ok(["ok", "degraded"].includes(assessmentEnvelope.status));
  assert.equal(assessment.isError, false);
  console.info(`Inspector upgrade assessment: ${assessmentEnvelope.status}`);
  const preview = await invoke("tools/call", ["--tool-name", "drift_cache_rebuild_preview"]);
  const envelope = preview.structuredContent as { status: string; data: { preview_token: string; expires_at: string } };
  assert.equal(envelope.status, "ok");
  assert.equal(preview.isError, false);
  assert.ok(envelope.data.preview_token.length > 0);
  assert.ok(Date.parse(envelope.data.expires_at) > Date.now());
  assert.equal(fs.readFileSync(path.join(projectRoot, "composer.json"), "utf8"), before);
  console.info("Inspector CLI acceptance passed: initialization, exact 4 resources/16 tools, all resource reads, assessment, preview token; 8 CLI processes exited 0. No apply invoked. SDK proof separately checks server EOF exit and stdout discipline. Web UI and real-project acceptance remain pending.");
}).catch((error: unknown) => {
  console.error("Inspector acceptance failed:", error);
  process.exitCode = 1;
});
