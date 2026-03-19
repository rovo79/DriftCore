import type { CliExecutionResult } from "./sandboxExecution.js";
import type { RedactionConfig } from "../types.js";
import type { ResourceOrToolResponse } from "../types.js";

const MAX_STDERR_LENGTH = 2000;

export interface CliErrorContext {
  command: string;
  args: string[];
  cwd: string;
}

export interface CliErrorOptions {
  missingBinaryCode: string;
  missingBinaryMessage: string;
}

const POSIX_PATH_REGEX = /(^|\s)(\/[^\s"'`]+)/g;
const WINDOWS_PATH_REGEX = /\b([A-Za-z]:\\[^\s"'`]+)/g;

function getRedactionPlaceholder(redaction?: RedactionConfig): string {
  return redaction?.placeholder ?? "[redacted]";
}

function redactUnknown(value: unknown, redaction?: RedactionConfig): unknown {
  if (!redaction?.enabled) {
    return value;
  }

  if (typeof value === "string") {
    return redactPaths(value, redaction);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, redaction));
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = redactUnknown(nestedValue, redaction);
    }
    return redacted;
  }

  return value;
}

export function redactPaths(input: string, redaction?: RedactionConfig): string {
  if (!redaction?.enabled) {
    return input;
  }

  const placeholder = getRedactionPlaceholder(redaction);
  const withPosixRedacted = input.replace(
    POSIX_PATH_REGEX,
    (_match, prefix) => `${prefix}${placeholder}`,
  );
  return withPosixRedacted.replace(WINDOWS_PATH_REGEX, placeholder);
}

function formatCliInvocation(context: CliErrorContext, redaction?: RedactionConfig): string {
  return redactPaths([context.command, ...context.args].join(" "), redaction);
}

export function mapCliResultToError<T>(
  result: CliExecutionResult,
  context: CliErrorContext,
  options: CliErrorOptions,
  redaction?: RedactionConfig,
): ResourceOrToolResponse<T> {
  const diagnostics = redactUnknown({
    command: context.command,
    args: context.args,
    cwd: context.cwd,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  }, redaction) as Record<string, unknown>;

  if (result.timedOut) {
    return {
      status: "timeout",
      error: {
        code: "E_TIMEOUT",
        message: `${formatCliInvocation(context, redaction)} exceeded timeout`,
        diagnostics,
        stderr: truncateStderr(result.stderr, redaction),
      },
    };
  }

  if (result.exitCode === null) {
    return {
      status: "error",
      error: {
        code: options.missingBinaryCode,
        message: options.missingBinaryMessage,
        diagnostics,
        stderr: truncateStderr(result.stderr, redaction),
      },
    };
  }

  return {
    status: "error",
    error: {
      code: "E_CLI_NONZERO_EXIT",
      message: `${formatCliInvocation(context, redaction)} exited with code ${result.exitCode}`,
      diagnostics,
      stderr: truncateStderr(result.stderr, redaction),
    },
  };
}

export function truncateStderr(
  stderr: string | undefined,
  redaction?: RedactionConfig,
): string | undefined {
  if (!stderr) {
    return undefined;
  }
  const trimmed = redactPaths(stderr.trim(), redaction);
  if (trimmed.length <= MAX_STDERR_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_STDERR_LENGTH)}…`;
}
