# Agents and DriftCore

This document describes how external agents should use DriftCore through MCP.

DriftCore is not an agent runner. It does not handle planning, long term memory, or conversation orchestration. It provides:

- Project aware context for a single Drupal codebase
- A small set of curated tools (Drush, Composer, etc.)
- Stable MCP resources and tools that agents can call

Your agent runner (Claude, ChatGPT MCP, a custom framework, etc.) is responsible for how and when to call these tools.

---

## 1. How agents should think about DriftCore

You can think of DriftCore as a "project console" for a specific Drupal repo. Before an agent suggests code or commands, it should:

1. Discover the project context  
2. Inspect the current state with Drush and Composer tools  
3. Use that information to ground any recommendations

Agents should never assume:

- Drupal core version  
- Enabled modules or themes  
- Folder layout or config paths  

They should always verify these through DriftCore first.

---

## 2. Available resources (v0.1)

### 2.1 `project_manifest`

Use this to understand what project you are in.

Typical fields (exact schema may evolve):

- `drupal_root`  
- `drupal_core_version`  
- `project_type` (for example "drupal-recommended-project")  
- `composer_json` (subset of composer.json relevant for agents)  
- `custom_modules[]` with `name` and `path`  
- `custom_themes[]` with `name` and `path`  

**Agent guidance:**

- Call `project_manifest` at the start of any session dealing with a new project.
- Use the returned Drupal core version when suggesting APIs.  
- Use module and theme paths when talking about files or code locations.

---

## 3. Available tools (v0.1)

All tools in v0.1 are read only. They should not modify the project.

### 3.1 `drift.drush_status`

Runs a fixed `drush status` and returns a structured summary.

Use it to:

- Confirm Drupal core version reported by Drush
- See PHP version, database driver, and site path
- Cross check environment assumptions

### 3.2 `drift.drush_pml`

Runs a fixed `drush pml` and returns enabled modules and themes in a structured form.

Use it to:

- See which core, contrib, and custom modules are enabled
- Check which themes are active
- Avoid recommending modules that are already present or enabled

### 3.3 `drift.composer_info`

Returns:

- The project name from composer.json
- The full set of `require` dependencies
- Optional summary of the lock file

Use it to:

- Understand which Drupal packages are actually installed
- Check compatibility constraints before suggesting new packages

### 3.4 `drift.composer_outdated`

Runs `composer outdated` in a safe way and returns a parsed list of outdated packages.

Use it to:

- Identify modules and libraries that may need upgrades
- Prioritize which packages to discuss in an upgrade plan

---

## 4. Agent patterns

This section describes common patterns agents should follow.

### 4.1 Project discovery pattern

Goal: build a mental model of the project before suggesting changes.

Recommended sequence:

1. Call `project_manifest`  
2. Call `drift.drush_status`  
3. Call `drift.drush_pml`  
4. Optionally call `drift.composer_info`  

Then:

- Summarize:
  - Drupal core version  
  - Notable modules and themes  
  - Any obvious characteristics from composer.json  
- Only after this summary should you propose any plan or code.

### 4.2 Upgrade assessment pattern

Goal: help the user understand upgrade options, without running commands.

Recommended sequence:

1. `project_manifest`  
2. `drift.composer_outdated`  

Then:

- Group outdated packages into:
  - Drupal core and related packages  
  - Key contrib modules  
  - Everything else  
- Describe potential risks at a high level based on the stack  
- Suggest a staged upgrade approach  
- Do **not** suggest running composer commands directly in v0.1  
  (writing commands as text for the user to run is fine, executing them is not)

### 4.3 Feature planning pattern

Goal: plan a new feature or custom module that fits project conventions.

Recommended sequence:

1. `project_manifest`  
2. `drift.drush_pml`  

Then:

- Check if a similar module or feature already exists  
- If not, propose:
  - Module name and purpose  
  - Directory path that matches existing custom modules  
  - High level list of components (services, plugins, config)  

Do **not** assume file structure that conflicts with the actual paths returned by `project_manifest`.

---

## 5. Safety and constraints

Rules for any agent using DriftCore v0.1:

1. **Read only tools**  
   - All tools are inspection only in v0.1.  
   - Do not expect DriftCore to write files or run destructive operations.  
   - If you need to propose changes, describe them as text or patches for the human to apply.

2. **Always ground recommendations in tool output**  
   - If you are about to say "This project runs Drupal X", first verify with `project_manifest` and `drift.drush_status`.  
   - If your earlier assumptions conflict with tool output, explicitly update your understanding and correct yourself.

3. **Handle errors transparently**  
   - If a tool returns an error (missing Drush, Composer, invalid root), surface that to the user.  
   - Do not invent alternate commands or flags that DriftCore does not expose.

4. **Do not guess paths**  
   - Use the module and theme paths from `project_manifest`.  
   - If a module is not listed, assume it does not exist until the user confirms otherwise.

---

## 6. Example agent persona

Here is an example of how you might configure an ag
