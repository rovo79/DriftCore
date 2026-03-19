import fs from "node:fs";
import path from "node:path";
import type { ServerConfig } from "../types.js";
import { resolveProjectRoot } from "./projectPaths.js";

export function resolveDrushCommand(config: ServerConfig): string {
  if (config.drushPath) {
    return config.drushPath;
  }

  const projectRoot = resolveProjectRoot(config);
  const vendorDrush = path.join(projectRoot, "vendor", "bin", "drush");
  if (fs.existsSync(vendorDrush)) {
    return vendorDrush;
  }

  return "drush";
}
