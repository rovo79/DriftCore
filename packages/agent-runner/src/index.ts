import { generateTypeScriptSDK, type ResourceDescriptor } from "./sdk.js";
import { executeSandbox } from "./sandbox.js";

const fallbackResources: ResourceDescriptor[] = [
  {
    id: "schema.entityTypes",
    name: "Drupal entity type registry",
    description: "Local fallback entity registry used during STDIO development.",
    mimeType: "application/json",
    data: {
      entityTypes: [
        {
          machineName: "node",
          label: "Content",
          description: "Drupal content entity representing published site content.",
          fields: [
            { name: "title", type: "string", description: "Human readable title." },
            { name: "body", type: "text_long", description: "Rich text body field." },
            { name: "uid", type: "entity:user", description: "Reference to the authoring user." },
            { name: "status", type: "boolean", description: "Published flag." },
          ],
        },
        {
          machineName: "user",
          label: "User",
          description: "Account entity storing authentication and profile data.",
          fields: [
            { name: "name", type: "string", description: "Login username." },
            { name: "mail", type: "email", description: "Primary e-mail address." },
            { name: "roles", type: "string[]", description: "Assigned Drupal roles." },
            { name: "status", type: "boolean", description: "Active state." },
          ],
        },
      ],
    },
  },
  {
    id: "config.exported",
    name: "Drupal exported configuration",
    description: "Local fallback configuration snapshot used during STDIO development.",
    mimeType: "application/json",
    data: {
      modules: [
        { name: "drupal", type: "core" },
        { name: "toolbar", type: "core" },
        { name: "block", type: "core" },
      ],
      settings: {
        site: {
          name: "DriftCore Sandbox",
          mail: "admin@example.com",
          slogan: "Composable automation for Drupal",
        },
      },
    },
  },
];

export interface AgentRunnerOptions {
  serverEndpoint: string;
  transport: "stdio" | "http";
  sdkOutputDir: string;
  sandboxRuntime: "node" | "deno" | "php";
  sandboxBootstrapCode: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export class AgentRunner {
  constructor(private readonly options: AgentRunnerOptions) {}

  async start() {
    if (this.options.transport === "stdio") {
      console.info("STDIO transport selected; falling back to local resource snapshot.");
    } else {
      console.info(`Connecting to MCP HTTP server at ${this.options.serverEndpoint}`);
    }

    const resources = await this.loadResources();
    await generateTypeScriptSDK({
      outputDir: this.options.sdkOutputDir,
      resources,
      logger: console,
    });

    const sandboxResult = await executeSandbox({
      code: this.options.sandboxBootstrapCode,
      runtime: this.options.sandboxRuntime,
      context: { resources },
    });

    if (sandboxResult.warnings.length > 0) {
      sandboxResult.warnings.forEach((warning) => console.warn(warning));
    }
    sandboxResult.logs.forEach((line) => console.info(`[sandbox] ${line}`));
    console.info("Agent runner initialization complete");

    return { resources, sandboxResult };
  }

  private async loadResources(): Promise<ResourceDescriptor[]> {
    if (this.options.transport === "http") {
      const url = new URL("/resources", this.options.serverEndpoint).toString();
      const payload = await fetchJson<{ resources: ResourceDescriptor[] }>(url);
      return payload.resources;
    }

    return fallbackResources;
  }
}

export async function createDefaultRunner() {
  const runner = new AgentRunner({
    serverEndpoint: "http://localhost:8080",
    transport: "http",
    sdkOutputDir: ".driftcore/sdk",
    sandboxRuntime: "node",
    sandboxBootstrapCode: "console.log('Drupal sandbox ready for automation');",
  });
  await runner.start();
  return runner;
}
