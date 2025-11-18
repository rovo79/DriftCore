# DriftCore

DriftCore is an MCP powered dev harness for Drupal projects. It runs alongside your repo and toolchain and gives AI agents structured access to your project context, Drush, Composer, and configuration workflows so they can actually help build and maintain Drupal sites instead of guessing.

> Status: experimental, early stage. Interfaces and structure are still in flux.

---

## What DriftCore is

DriftCore is for Drupal developers and site builders who want AI assistants that understand a **real project**, not just generic Drupal examples.

At a high level, DriftCore:

- Sits next to a Drupal codebase, not inside Drupal.
- Reads and exposes project context (core version, modules, file layout, config locations).
- Bridges AI tooling into Drush, Composer, and other CLI commands in a controlled way.
- Provides opinionated scaffolds and blueprints for common Drupal patterns.
- Speaks the Model Context Protocol (MCP), so any MCP compatible AI client can connect.

The goal is to make it possible for an AI agent to:

- Inspect the actual state of a project.
- Propose concrete changes (code, config, dependencies).
- Run checks and commands.
- Iterate safely, instead of hallucinating module structure from thin air.

---

## What DriftCore is not

To avoid confusion with related work:

- DriftCore is **not** a generic “MCP server for any Drupal site”.
- DriftCore does **not** run inside Drupal as a module.
- DriftCore is **not** focused on content editors or live site management.
- DriftCore does **not** try to replace the official Drupal MCP module that exposes entities, JSON:API, Views, and Drupal AI tools.

If you want an MCP endpoint on a running Drupal site for content and site management, you should look at the Drupal MCP module. DriftCore is aimed at the **developer experience around a specific project**.

---

## Core ideas

### Project aware

DriftCore is designed to understand your project as it actually exists on disk and on the dev stack.

Examples of the sort of context it will expose as MCP resources:

- `project_manifest`  
  - Drupal core version  
  - Composer dependencies (especially `drupal/*`)  
  - Custom module and theme locations  

- `project_modules` (planned)  
  - Enabled modules and themes via Drush  
  - Distinction between core / contrib / custom  

- `project_config_layout` (planned)  
  - Config sync directory  
  - Any environment specific overrides  

This context gives an AI a grounded view of “where it is” before it starts proposing code.

### Tooling bridge

DriftCore exposes a curated set of tools that map to the commands Drupal devs actually use, such as:

- Drush commands (status, module list, cache rebuild, database updates)
- Composer operations (require, update, audit)
- Config workflows (export, import, diff)
- Code checks (lint, static analysis, tests)  

These are wrapped as MCP tools with:

- Clear input and output schemas.
- Guardrails to avoid destructive free form shell access.
- Room for policies such as “dry run first, then apply”.

### Blueprints and scaffolds

In addition to raw tools, DriftCore will gradually grow a set of opinionated blueprints, for example:

- Create a new feature module wired for config export.
- Add a content type with JSON:API and a default View.
- Scaffold a custom theme with a preferred front end stack.
- Set up basic testing and CI configuration for a project.

The intent is to capture repeatable patterns in a form an AI can call, reconfigure, and extend.

---

## Typical use cases

Some examples of the kind of workflows DriftCore is meant to support:

- **Upgrade helper**  
  - Inspect core and contrib versions.  
  - Suggest upgrade steps.  
  - Run Composer updates and Drush database updates behind tools.  
  - Run tests and report back.

- **Feature module scaffolding**  
  - Read existing custom modules and project conventions.  
  - Propose a new module structure.  
  - Generate boilerplate code and config.  
  - Wire it into routing, permissions, and services.

- **Config hygiene and sync**  
  - List configuration changes between environments.  
  - Help curate which changes should be exported or imported.  
  - Run `cim` or `cex` through safe tools and report status.

- **Code review and refactor**  
  - Analyze a specific module or theme directory.  
  - Suggest refactors that respect the actual project layout and versions.  
  - Apply changes as patches and run checks.

---

## Architecture overview

High level view:

1. **DriftCore service**  
   Runs alongside your Drupal project (for example on a dev machine or in a container) and exposes an MCP server endpoint.

2. **Connectors to the project**  
   Adapters that know how to:
   - Read composer.json, Drush output, and config directories.
   - Discover modules and themes.
   - Execute Drush and Composer with constraints.

3. **MCP tools and resources**  
   DriftCore defines a set of tools and resources surfaced through MCP, which an AI client can call in sequence to carry out tasks.

4. **Client**  
   Any MCP compatible AI client (such as an IDE extension or chat interface) connects to DriftCore and orchestrates tools using your prompts and workflows.

Concrete implementation details and APIs are still evolving, but this is the shape the project is moving toward.

---

## Relationship to the Drupal MCP module

The official Drupal MCP module and DriftCore should be seen as **complementary**:

- **Drupal MCP module**  
  - Installed inside Drupal.  
  - Exposes entities, Views, JSON:API, Drush, and AI tools to MCP.  
  - Aims to make a Drupal site “AI ready” for a wide range of use cases.

- **DriftCore**  
  - Runs next to the Drupal codebase in the dev environment.  
  - Focuses on project structure, code, and dev workflows.  
  - Aims to make AI actually effective as a Drupal developer and site builder.

You can reasonably use both: DriftCore while building and maintaining the site, and the Drupal MCP module for live site automation and content workflows.

---

## Getting started (early preview)

This is intentionally light for now because the internals are still changing. The rough flow looks like:

1. Clone the repository

   ```bash
   git clone https://github.com/rovo79/DriftCore.git
   cd DriftCore
   ```

2. Install dependencies
   Use the package manager you prefer for this repo (for example):
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. Check package.json for the actual scripts and tooling in use.
   Run the dev server
   ```bash
   npm run dev
   ```
   or the equivalent script defined in `package.json`.

4. Point your MCP compatible client at the DriftCore MCP endpoint
   Exact transport details (stdio vs http) are still being finalized. For now, consult the repository documentation or examples as they are added.

---

## Roadmap
Short term goals:
- Define and stabilize the initial set of MCP tools:
  - Drush inspection commands (status, pml, cr)
  - Composer inspection commands (outdated, audit)
- Implement project_manifest and related resources for project context.
- Add a simple “create custom module skeleton” blueprint.
- Document how to connect a popular MCP client to a local DriftCore instance.

Mid term goals:
- Expand the Drush and Composer tool surface with safe write operations.
- Add config aware workflows (export, import, diff) with dry run support.
- Provide example agent prompts and flows for:
  - Upgrade assistance
  - Feature creation
  - Code review

Longer term ideas:
- Integration with the official Drupal MCP module to inspect or sync config and content remotely.
- Opinionated presets for different project profiles (single site, multi site, headless, etc).
- Test and validation harnesses for AI generated changes.

---

## Contributing
DriftCore is very early, and contributions at the level of architecture discussions, use case proposals, and small experimental PRs are all welcome.

If you are a Drupal developer who wants a better AI dev experience, feedback on what would actually help you day to day is especially valuable.

---

License
MIT
