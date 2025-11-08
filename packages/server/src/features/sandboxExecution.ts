// TODO: Provide isolated sandbox execution for user-supplied scripts.
export interface SandboxExecutionOptions {
  code: string;
  runtime: "deno" | "node" | "php";
}

export async function executeInSandbox(
  _options: SandboxExecutionOptions
): Promise<{ output: string }> {
  // Placeholder for sandbox execution - returns canned response.
  return { output: "Sandbox execution not yet implemented" };
}
