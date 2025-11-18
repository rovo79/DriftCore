import type { CliExecutionResult } from "./sandboxExecution.js";
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

export function mapCliResultToError<T>(
  result: CliExecutionResult,
  context: CliErrorContext,
  options: CliErrorOptions,
): ResourceOrToolResponse<T> {
  const diagnostics = {
    command: context.command,
    args: context.args,
    cwd: context.cwd,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  };

  if (result.timedOut) {
    return {
      status: "timeout",
      error: {
        code: "E_TIMEOUT",
        message: `${context.command} ${context.args.join(" ")} exceeded timeout`,
        diagnostics,
        stderr: truncateStderr(result.stderr),
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
        stderr: truncateStderr(result.stderr),
      },
    };
  }

  return {
    status: "error",
    error: {
      code: "E_CLI_NONZERO_EXIT",
      message: `${context.command} exited with code ${result.exitCode}`,
      diagnostics,
      stderr: truncateStderr(result.stderr),
    },
  };
}

export function truncateStderr(stderr: string | undefined): string | undefined {
  if (!stderr) {
    return undefined;
  }
  const trimmed = stderr.trim();
  if (trimmed.length <= MAX_STDERR_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_STDERR_LENGTH)}…`;
}

