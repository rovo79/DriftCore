// TODO: Integrate with Drush CLI and expose commands as MCP tools.
export interface DrushTool {
  name: string;
  description: string;
  command: string;
}

export function getDrushTools(): DrushTool[] {
  // Placeholder ensures consumers have a concrete shape during early integration.
  return [];
}
