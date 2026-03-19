export interface MCPResource {
  id: string;
  name: string;
  description: string;
  source?: "template" | "discovered";
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
  binaryValidation: BinaryValidationResult;
  httpHost?: string;
  requestRateLimiter?: {
    isAllowed(ip: string): boolean;
  };
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

export interface WritePreviewData<TPreview> {
  preview: TPreview;
  preview_token: string;
  expires_at: string;
}

export interface WritePreviewResponse<TPreview> {
  status: ResponseStatus;
  data?: WritePreviewData<TPreview>;
  error?: ErrorDetail;
}

export interface WriteChange {
  type: "file_created" | "file_modified" | "command_executed";
  target: string;
  detail: string;
}

export interface WriteApplyData<TResult> {
  result: TResult;
  changes: WriteChange[];
}

export interface WriteApplyResponse<TResult> {
  status: ResponseStatus;
  data?: WriteApplyData<TResult>;
  error?: ErrorDetail;
}

export interface WriteVerificationData<TVerification> {
  verified: boolean;
  verification: TVerification;
  warnings: string[];
}

export interface WriteVerifyResponse<TVerification> {
  status: ResponseStatus;
  data?: WriteVerificationData<TVerification>;
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

export interface RedactionConfig {
  enabled?: boolean;
  placeholder?: string;
}

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
}

export interface BinaryValidationEntry {
  resolved: string | null;
  exists: boolean;
}

export interface BinaryValidationResult {
  drush: BinaryValidationEntry;
  composer: BinaryValidationEntry;
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
  redaction?: RedactionConfig;
  rateLimit?: RateLimitConfig;
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
