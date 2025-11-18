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
  - Run Composer updates an
