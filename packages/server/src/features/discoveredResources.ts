import type { MCPResource } from "../types.js";

export function listDiscoveredResources(): MCPResource[] {
  return [
    {
      id: "project_modules",
      name: "Drupal project modules and themes",
      description:
        "Discovered module and theme state for the configured project, derived from Drush with filesystem fallback for custom extensions.",
      source: "discovered",
      mimeType: "application/json",
      data: {
        endpoint: "/project-modules",
        action: "project_modules",
      },
    },
    {
      id: "project_config_layout",
      name: "Drupal project config layout",
      description:
        "Discovered config sync layout, config split hints, and environment-related configuration indicators for the configured project.",
      source: "discovered",
      mimeType: "application/json",
      data: {
        endpoint: "/project-config-layout",
        action: "project_config_layout",
      },
    },
    {
      id: "project_checks",
      name: "Drupal project checks",
      description:
        "Diagnostic checks for binary availability, root validity, config sync detection, and capability flags for DriftCore workflows.",
      source: "discovered",
      mimeType: "application/json",
      data: {
        endpoint: "/project-checks",
        action: "project_checks",
      },
    },
  ];
}
