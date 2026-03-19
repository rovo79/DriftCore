import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ServerConfig } from "../types.js";

export interface WriteFixture {
  cleanup: () => void;
  projectRoot: string;
  drupalRoot: string;
  config: ServerConfig;
  configPath: string;
  drushPath: string;
  syncDirectory: string;
}

export function createWriteFixture(): WriteFixture {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-write-"));
  const projectRoot = tmpDir;
  const drupalRoot = path.join(projectRoot, "web");
  const syncDirectory = path.join(projectRoot, "config", "sync");
  const drushPath = path.join(projectRoot, "fake-drush.mjs");
  const configPath = path.join(projectRoot, "driftcore.config.json");

  fs.mkdirSync(drupalRoot, { recursive: true });
  fs.mkdirSync(syncDirectory, { recursive: true });

  fs.writeFileSync(
    path.join(projectRoot, "composer.json"),
    JSON.stringify(
      {
        name: "acme/site",
        type: "project",
        require: {
          "drupal/core-recommended": "^11.1",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    path.join(projectRoot, "composer.lock"),
    JSON.stringify(
      {
        packages: [
          {
            name: "drupal/core-recommended",
            version: "11.1.4",
            type: "drupal-core",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(path.join(syncDirectory, "system.site.yml"), "name: Pending\n", "utf8");

  fs.writeFileSync(
    drushPath,
    `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const command = args[0] ?? "";
const cwd = process.cwd();
const syncDirectory = path.resolve(cwd, "../config/sync");
const systemSitePath = path.join(syncDirectory, "system.site.yml");

if (command === "status") {
  console.log(JSON.stringify({
    "drupal-version": "11.1.5",
    "php-version": "8.4.14",
    "db-driver": "sqlite",
    "site": "sites/default",
    "config-sync": "../config/sync"
  }, null, 2));
  process.exit(0);
}

if (command === "config:status") {
  const current = fs.existsSync(systemSitePath) ? fs.readFileSync(systemSitePath, "utf8") : "";
  const rows = current.includes("Exported")
    ? []
    : [{ name: "system.site", state: "Different" }];
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

if (command === "cache:rebuild") {
  console.log("Cache rebuild complete.");
  process.exit(0);
}

if (command === "config:export") {
  fs.mkdirSync(syncDirectory, { recursive: true });
  fs.writeFileSync(systemSitePath, "name: Exported\\n", "utf8");
  fs.writeFileSync(path.join(syncDirectory, "new.exported.yml"), "new: value\\n", "utf8");
  console.log("Configuration exported.");
  process.exit(0);
}

console.error(\`Unknown command: \${args.join(" ")}\`);
process.exit(1);
`,
    "utf8",
  );
  fs.chmodSync(drushPath, 0o755);

  const config: ServerConfig = {
    drupalRoot,
    drushPath,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 0, pml: 0 },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
    projectRoot,
    drupalRoot,
    config,
    configPath,
    drushPath,
    syncDirectory,
  };
}
