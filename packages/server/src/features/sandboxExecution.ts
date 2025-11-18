import { spawn } from "node:child_process";
import process from "node:process";

// TODO: Provide isolated sandbox execution for user-supplied scripts.
export interface SandboxExecutionOptions {
  code: string;
  runtime: "deno" | "node" | "php";
}

export async function executeInSandbox(
  _options: SandboxExecutionOptions,
): Promise<{ output: string }> {
  // Placeholder for sandbox execution - returns canned response.
  return { output: "Sandbox execution not yet implemented" };
}

export interface CliExecutionOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxParallel?: number;
}

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

type ResolveFn = () => void;
const pendingQueue: ResolveFn[] = [];
let activeProcesses = 0;

function scheduleExecution(maxParallel: number, executor: () => void) {
  if (activeProcesses < maxParallel) {
    activeProcesses += 1;
    executor();
    return;
  }
  pendingQueue.push(() => {
    activeProcesses += 1;
    executor();
  });
}

function finalizeExecution() {
  activeProcesses = Math.max(0, activeProcesses - 1);
  const next = pendingQueue.shift();
  if (next) {
    next();
  }
}

export async function runCliCommand(
  options: CliExecutionOptions,
): Promise<CliExecutionResult> {
  const { command, args, cwd, env, timeoutMs, maxParallel = 1 } = options;
  const start = Date.now();

  return new Promise<CliExecutionResult>((resolve) => {
    scheduleExecution(maxParallel, () => {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        detached: process.platform !== "win32",
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        finalizeExecution();
      };

      const killProcessTree = () => {
        if (child.pid) {
          try {
            if (process.platform !== "win32") {
              process.kill(-child.pid, "SIGKILL");
            }
          } catch {
            // ignore
          }
        }
        child.kill("SIGKILL");
      };

      if (timeoutMs && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          killProcessTree();
        }, timeoutMs);
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        cleanup();
        const durationMs = Date.now() - start;
        const message = (error as Error).message;
        resolve({
          stdout,
          stderr: stderr || message,
          exitCode: null,
          timedOut,
          durationMs,
        });
      });

      child.on("close", (code) => {
        cleanup();
        const durationMs = Date.now() - start;
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut,
          durationMs,
        });
      });
    });
  });
}
