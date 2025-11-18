import fs from "node:fs";
import path from "node:path";
import type { ServerConfig } from "../types.js";

export function resolveProjectRoot(config: ServerConfig): string {
  const drupalRoot = path.resolve(config.drupalRoot);
  const candidateComposer = path.join(drupalRoot, "composer.json");
  if (fs.existsSync(candidateComposer)) {
    return drupalRoot;
  }

  const parent = path.dirname(drupalRoot);
  const parentComposer = path.join(parent, "composer.json");
  if (fs.existsSync(parentComposer)) {
    return parent;
  }

  return drupalRoot;
}

export function readJsonFile<T = unknown>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function toProjectRelativePath(projectRoot: string, targetPath: string): string {
  const absoluteTarget = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(projectRoot, targetPath);
  return path.relative(projectRoot, absoluteTarget);
}

