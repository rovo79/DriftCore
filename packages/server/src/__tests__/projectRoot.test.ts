import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deriveDrupalRoot, discoverProjectRoot } from "../projectRoot.js";

for (const layout of ["web", "docroot", "."]) {
  test(`discovers and derives ${layout}/core from a nested directory`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-discovery-"));
    try {
      const root = path.join(dir, layout);
      const nested = path.join(root, "modules", "custom");
      fs.mkdirSync(path.join(root, "core"), { recursive: true });
      fs.mkdirSync(nested, { recursive: true });
      assert.equal(discoverProjectRoot(dir), dir);
      assert.equal(discoverProjectRoot(nested), dir);
      assert.equal(deriveDrupalRoot(dir), root);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("Composer Drupal dependencies identify the current or parent project", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-composer-"));
  try {
    const nested = path.join(dir, "nested");
    fs.mkdirSync(nested);
    for (const dependency of ["drupal/core-recommended", "drupal/core"]) {
      fs.writeFileSync(path.join(dir, "composer.json"),
        JSON.stringify({ require: { [dependency]: "^11" } }));
      assert.equal(discoverProjectRoot(dir), dir);
      assert.equal(discoverProjectRoot(nested), dir);
      assert.equal(deriveDrupalRoot(dir), undefined);
    }
    fs.writeFileSync(path.join(dir, "composer.json"), JSON.stringify({ require: { "symfony/console": "^7" } }));
    assert.equal(discoverProjectRoot(dir), undefined);
    fs.writeFileSync(path.join(dir, "composer.json"), "{invalid");
    assert.equal(discoverProjectRoot(dir), undefined);
    fs.writeFileSync(path.join(dir, "composer.json"), "null");
    assert.equal(discoverProjectRoot(dir), undefined);
    assert.equal(discoverProjectRoot(path.parse(dir).root), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Drupal root derivation prefers web, then docroot, then root and ignores files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-layout-"));
  try {
    for (const layout of [".", "docroot", "web"]) {
      fs.mkdirSync(path.join(dir, layout, "core"), { recursive: true });
      assert.equal(deriveDrupalRoot(dir), path.join(dir, layout));
    }
    fs.rmSync(path.join(dir, "web", "core"), { recursive: true });
    fs.writeFileSync(path.join(dir, "web", "core"), "not a directory");
    assert.equal(deriveDrupalRoot(dir), path.join(dir, "docroot"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
