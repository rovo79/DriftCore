export interface DriftCoreCliOptions {
  projectRoot?: string;
  configPath?: string;
  help?: boolean;
}

export function parseCliArgs(argv: string[]): DriftCoreCliOptions {
  const options: DriftCoreCliOptions = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const [name] = arg.split("=", 1);
    if (name !== "--project-root" && name !== "--config") {
      throw new Error(`Unknown MCP option: ${arg}`);
    }
    const value = arg.includes("=") ? arg.slice(name.length + 1) : argv[++index];
    if (!value?.trim() || value.startsWith("-")) {
      throw new Error(`${name} requires a path`);
    }
    if (name === "--project-root") options.projectRoot = value;
    else options.configPath = value;
  }
  return options;
}
