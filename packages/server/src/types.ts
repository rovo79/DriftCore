export interface MCPResource {
  id: string;
  name: string;
  description: string;
  source?: string;
  mimeType: string;
  data: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  command: string;
  args?: string[];
  examples?: string[];
}

export interface MCPServerOptions {
  resources?: MCPResource[];
  tools?: MCPTool[];
  logger?: Pick<Console, "info" | "error" | "warn">;
}

export interface ServerState {
  resources: MCPResource[];
  tools: MCPTool[];
  logger: Pick<Console, "info" | "error" | "warn">;
}
