# @driftcore/agent-runner (runtime policy contract draft)

This package is still a lightweight placeholder, but it now documents a precise split of responsibilities between:

- **Skills** (declarative policy input), and
- **Agent runtime/client** (operative policy enforcement).

## Core principle

- If it says what should happen, it belongs in a **skill**.
- If it makes it happen, it belongs in the **runtime**.

Skills can express intent (preferences, constraints, escalation rules). Only runtime can attach/detach MCP servers, filter tool/resource visibility, and keep irrelevant capabilities out of model context.

## Mental model

- **MCP server/pack**: building full of tools.
- **Skill**: playbook for a job.
- **Runtime**: facilities manager with the keys.

The playbook can request access patterns; runtime enforces them.

## Runtime design target: `mounted != exposed`

Treat these as separate states:

- **Mounted**: runtime can reach the MCP pack/server.
- **Exposed**: model can see and invoke pack tools/resources/prompts.

A pack can be mounted but hidden from the model until a policy condition is satisfied.

## Minimal contract between skill and runtime

A skill should declare policy. Runtime should evaluate and enforce it.

```yaml
skill_id: drupal-audit

mcp_policy:
  startup_packs:
    - core.fs
    - core.git

  allowed_packs:
    - core.fs
    - core.git
    - docs.php
    - web.search

  default_visibility: hidden

  escalation:
    - when: evidence_gap
      expose:
        - docs.php

    - when: docs_exhausted
      expose:
        - web.search
```

## Runtime responsibilities (minimum viable)

1. **Pack registry**
   - Know available pack IDs and how to start/stop each MCP server.
2. **Policy evaluator**
   - Read `mcp_policy` from selected skill and compute desired mounted/exposed sets.
3. **Visibility model**
   - Enforce `default_visibility`, and expose only allowed packs.
4. **Escalation engine**
   - Detect conditions (`evidence_gap`, `docs_exhausted`) and apply policy transitions.
5. **Tool registry filter**
   - Rebuild the model-visible tool/resource/prompt catalog whenever exposure changes.

## Suggested first proof of concept

Implement a tiny runtime loop with three packs:

- `core`
- `local-dev`
- `web-research`

Policy behavior:

1. Start with `core` only exposed.
2. On `evidence_gap`, expose `local-dev`.
3. On `docs_exhausted`, expose `web-research`.

This validates the architecture seam before scaling policy complexity.
