import type { MCPTool } from "../types.js";

export function getDrushTools(): MCPTool[] {
  return [
    {
      name: "drush.cacheRebuild",
      description: "Clears all Drupal caches using the Drush cache:rebuild command.",
      command: "drush cache:rebuild",
      args: [],
      examples: [
        "drush cache:rebuild",
      ],
    },
    {
      name: "drush.configExport",
      description: "Exports the active Drupal configuration to the sync directory.",
      command: "drush config:export",
      args: ["--destination=/var/www/html/config/sync"],
      examples: [
        "drush config:export --destination=/var/www/html/config/sync",
      ],
    },
  ];
}
