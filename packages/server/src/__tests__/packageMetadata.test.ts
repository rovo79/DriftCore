import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageRoot = new URL("../../", import.meta.url);

test("npm package exposes the standard MCP executable with runtime metadata and docs", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("package.json", packageRoot), "utf8"));
  const lock = JSON.parse(fs.readFileSync(new URL("package-lock.json", packageRoot), "utf8"));
  assert.equal(pkg.name, "@driftcore/server");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.bin, { driftcore: "./dist/bin/mcp.js" });
  assert.deepEqual(pkg.files, ["dist", "README.md", "LICENSE", "!dist/__tests__", "!dist/integration"]);
  assert.deepEqual(pkg.engines, { node: ">=20" });
  assert.equal(pkg.license, "MIT");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.deepEqual(lock.packages[""].bin, { driftcore: "dist/bin/mcp.js" });
  for (const file of ["README.md", "LICENSE"]) {
    assert.ok(fs.readFileSync(new URL(file, packageRoot), "utf8").trim().length > 0);
  }
  assert.match(fs.readFileSync(new URL("dist/bin/mcp.js", packageRoot), "utf8"), /^#!\/usr\/bin\/env node\n/);
  assert.equal(pkg.scripts.start, "node dist/bin/mcp.js");
  assert.equal(pkg.scripts["start:mcp"], pkg.scripts.start);
  assert.equal(pkg.scripts["start:stdio:legacy"], "node dist/bin/stdio.js");
  assert.equal(pkg.scripts["start:http"], "node dist/bin/http.js");
  assert.equal(pkg.scripts["start:stdio"], undefined);
  assert.equal(pkg.dependencies["@modelcontextprotocol/sdk"], "1.29.0");
});
