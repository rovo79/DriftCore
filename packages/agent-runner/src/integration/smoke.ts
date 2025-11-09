import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AgentRunner } from "../index.js";

export async function runAgentIntegration() {
  const outputDir = await mkdtemp(path.join(tmpdir(), "driftcore-sdk-"));
  const runner = new AgentRunner({
    serverEndpoint: "http://localhost:65535", // intentionally unused in HTTP fallback
    transport: "stdio",
    sdkOutputDir: outputDir,
    sandboxRuntime: "node",
    sandboxBootstrapCode: "console.log('Sandbox ready')",
  });
  await runner.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentIntegration()
    .then(() => {
      console.info("Agent runner integration smoke test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Agent runner integration smoke test failed", error);
      process.exit(1);
    });
}
