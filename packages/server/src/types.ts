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
  /**
   * Optional explicit configuration file path. If omitted, the loader
   * will use DRIFTCORE_CONFIG or driftcore.config.json in CWD.
   */
  configPath?: string;
}

export interface OperationMeta {
  name: string;
  kind: "resource" | "tool" | "transport";
}

export type OperationLogger = <T>(
  meta: OperationMeta,
  executor: () => Promise<T> | T,
) => Promise<T>;

export interface ServerState {
  resources: MCPResource[];
  tools: MCPTool[];
  logger: Pick<Console, "info" | "error" | "warn">;
  config: ServerConfig | null;
  configError?: ErrorDetail;
  runOperation: OperationLogger;
}

export type ResponseStatus =
  | "ok"
  | "degraded"
  | "error"
  | "timeout"
  | "not_configured";

export interface ErrorDetail {
  code: string;
  message: string;
  diagnostics?: Record<string, unknown>;
  details?: Record<string, unknown>;
  exitCode?: number;
  stderr?: string;
}

export interface ResourceOrToolResponse<TData = unknown> {
  status: ResponseStatus;
  data?: TData;
  error?: ErrorDetail;
}

export interface TimeoutsConfig {
  drushStatusMs?: number;
  drushPmlMs?: number;
  composerInfoMs?: number;
  composerOutdatedMs?: number;
}

export interface CacheTtlConfig {
  projectManifest?: number;
  pml?: number;
}

export interface ServerConfig {
  drupalRoot: string;
  drushPath?: string;
  composerPath?: string;
  customModuleDirs?: string[];
  customThemeDirs?: string[];
  timeouts?: TimeoutsConfig;
  maxParallelCli?: number;
  cacheTtlMs?: CacheTtlConfig;
}

export function makeOkResponse<TData>(data: TData): ResourceOrToolResponse<TData> {
  return { status: "ok", data };
}

export function makeErrorResponse(
  code: string,
  message: string,
  extras?: Partial<ErrorDetail>,
): ResourceOrToolResponse {
  return {
    status: "error",
    error: {
      code,
      message,
      ...extras,
    },
  };
}
