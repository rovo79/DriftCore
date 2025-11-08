export interface MCPServerOptions {
  resources?: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  logger?: Pick<Console, "info" | "error" | "warn">;
}

export interface ServerState {
  resources: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  logger: Pick<Console, "info" | "error" | "warn">;
}
