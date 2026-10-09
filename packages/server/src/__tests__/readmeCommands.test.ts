import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageRoot = new URL("../../", import.meta.url);
const repoRoot = new URL("../../../../", import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(new URL("package.json", packageRoot), "utf8")) as {
  scripts: Record<string, string>;
};

const docs = [
  "README.md",
  "docs/ai/ARCHITECTURE.md",
  "docs/ai/COMMANDS.md",
  "docs/ai/DEPLOYMENT.md",
  "docs/ai/SECURITY_AND_RISKS.md",
  "docs/ai/TESTING.md",
];
const npmBuiltins = new Set(["ci", "install", "pack"]);

function documentedScripts(document: string): string[] {
  const found: string[] = [];
  // Recognize runnable shell lines, not prose such as "publication to npm and...".
  const expression = /^(?:[A-Z_]+=\S+\s+)?npm(?:\s+--prefix\s+packages\/server)?\s+(?:run\s+)?([a-z][a-z0-9:-]*)(?=\s|$)/gm;
  for (const match of document.matchAll(expression)) {
    if (!npmBuiltins.has(match[1])) found.push(match[1]);
  }
  return found;
}

test("documented npm script commands are defined in the server package", () => {
  const references = new Map<string, string[]>();
  for (const file of docs) {
    const markdown = fs.readFileSync(new URL(file, repoRoot), "utf8");
    for (const script of documentedScripts(markdown)) {
      assert.ok(packageJson.scripts[script], `${file} documents missing npm script ${script}`);
      references.set(script, [...(references.get(script) ?? []), file]);
    }
  }
  for (const script of documentedScripts(fs.readFileSync(new URL("README.md", packageRoot), "utf8"))) {
    assert.ok(packageJson.scripts[script], `packages/server/README.md documents missing npm script ${script}`);
    references.set(script, [...(references.get(script) ?? []), "packages/server/README.md"]);
  }
  for (const key of ["build", "lint", "test", "start", "start:mcp", "start:stdio:legacy",
    "start:http:legacy", "pack:check", "integration:mcp"]) {
    assert.ok(references.has(key), `document the ${key} npm script`);
  }
  assert.equal(references.has("start:stdio"), false);
  assert.equal(references.has("start:http"), false);
});
