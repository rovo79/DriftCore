import vm from "node:vm";

export interface SandboxExecutionOptions {
  code: string;
  runtime: "node" | "deno" | "php";
  timeoutMs?: number;
  context?: Record<string, unknown>;
}

export interface SandboxResult {
  logs: string[];
  result?: unknown;
  warnings: string[];
}

export async function executeSandbox({
  code,
  runtime,
  timeoutMs = 500,
  context = {},
}: SandboxExecutionOptions): Promise<SandboxResult> {
  if (runtime !== "node") {
    return {
      logs: [],
      result: undefined,
      warnings: [
        `${runtime} execution is not yet implemented; rerun with runtime=\"node\" to execute code.`,
      ],
    };
  }

  const logs: string[] = [];
  const sandboxConsole: Pick<Console, "log" | "error" | "warn"> = {
    log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    error: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
  };

  const script = new vm.Script(code, { filename: "sandbox.mjs" });
  const result = script.runInNewContext({ console: sandboxConsole, ...context }, { timeout: timeoutMs });

  return { logs, result, warnings: [] };
}
