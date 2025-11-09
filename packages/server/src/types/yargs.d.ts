declare module "yargs" {
  interface OptionDefinition {
    alias?: string;
    type?: "string" | "number" | "boolean";
    default?: unknown;
    describe?: string;
  }
  interface YargsInstance<T = Record<string, unknown>> {
    option(name: string, options: OptionDefinition): YargsInstance<T>;
    help(): YargsInstance<T>;
    parseAsync(): Promise<T>;
  }
  function yargs(args: string[] | ReadonlyArray<string>): YargsInstance;
  export default yargs;
}

declare module "yargs/helpers" {
  export function hideBin(argv: string[]): string[];
}
