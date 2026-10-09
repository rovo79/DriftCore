import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "./features/projectPaths.js";

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function deriveDrupalRoot(projectRoot: string): string | undefined {
  const root = path.resolve(projectRoot);
  return [path.join(root, "web"), path.join(root, "docroot"), root]
    .find((candidate) => isDirectory(path.join(candidate, "core")));
}

export function discoverProjectRoot(startPath: string): string | undefined {
  let candidate = path.resolve(startPath);
  while (true) {
    const composer = readJsonFile<Record<string, unknown>>(path.join(candidate, "composer.json"));
    const require = composer?.require;
    if (require && typeof require === "object" && !Array.isArray(require) &&
      ["drupal/core-recommended", "drupal/core"].some((name) =>
        typeof (require as Record<string, unknown>)[name] === "string")) {
      return candidate;
    }
    if (deriveDrupalRoot(candidate)) {
      // A conventional Drupal root is inside the consumer's Composer project.
      if (["web", "docroot"].includes(path.basename(candidate)) &&
        isDirectory(path.join(candidate, "core"))) return path.dirname(candidate);
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) return undefined;
    candidate = parent;
  }
}
