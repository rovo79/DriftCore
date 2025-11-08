export interface AgentRunnerOptions {
  serverEndpoint: string;
  transport: "stdio" | "http";
}

export class AgentRunner {
  constructor(private readonly options: AgentRunnerOptions) {}

  async start() {
    // TODO: Implement real orchestration logic connecting to MCP server.
    if (this.options.transport === "stdio") {
      console.info("Starting agent runner in STDIO bridge mode");
    } else {
      console.info(`Connecting to MCP HTTP server at ${this.options.serverEndpoint}`);
    }
    console.info("Agent runner stub initialized");
  }
}

export async function createDefaultRunner() {
  const runner = new AgentRunner({ serverEndpoint: "http://localhost:8080", transport: "http" });
  await runner.start();
  return runner;
}
