import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createMCPServer } from "../index.js";

export async function runServerSmokeTest() {
  const server = createMCPServer({ logger: console });
  assert.ok(server, "Server factory should return handlers");
  const httpServer = await server.handleHttp(0);
  const address = httpServer.address() as AddressInfo;
  assert.ok(address, "Server should have a bound address");

  const baseUrl = `http://localhost:${address.port}`;

  const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
  assert.equal(health.status, "ok");
  assert.equal(typeof health.tools, "number");

  const resources = await fetch(`${baseUrl}/resources`).then((res) => res.json());
  assert.ok(Array.isArray(resources.resources));

  const manifest = await fetch(`${baseUrl}/project-manifest`).then((res) => res.json());
  assert.ok(manifest.status);

  const modules = await fetch(`${baseUrl}/project-modules`).then((res) => res.json());
  assert.ok(modules.status);

  const configLayout = await fetch(`${baseUrl}/project-config-layout`).then((res) => res.json());
  assert.ok(configLayout.status);

  const checks = await fetch(`${baseUrl}/project-checks`).then((res) => res.json());
  assert.ok(checks.status);

  const drushStatus = await fetch(`${baseUrl}/drush/status`).then((res) => res.json());
  assert.ok(drushStatus.status);

  const composerInfo = await fetch(`${baseUrl}/composer/info`).then((res) => res.json());
  assert.ok(composerInfo.status);

  const upgradeAssessment = await fetch(`${baseUrl}/workflows/upgrade-assessment`).then((res) =>
    res.json(),
  );
  assert.ok(upgradeAssessment.status);

  const configDrift = await fetch(`${baseUrl}/workflows/config-drift`).then((res) => res.json());
  assert.ok(configDrift.status);

  const scaffoldPlan = await fetch(
    `${baseUrl}/workflows/scaffold-plan?machine_name=acme_blog&target_type=module`,
  ).then((res) => res.json());
  assert.ok(scaffoldPlan.status);

  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runServerSmokeTest()
    .then(() => {
      console.info("HTTP transport smoke test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("HTTP transport smoke test failed", error);
      process.exit(1);
    });
}
