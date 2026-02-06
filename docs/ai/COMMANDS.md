# COMMANDS

- **Working directory assumption for commands below**: `packages/server`.

## Build, lint, test

- `npm install`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run integration`

## Run server

- **STDIO transport**
  - `DRIFTCORE_CONFIG=/path/to/driftcore.config.json npm run start:stdio`
- **HTTP transport**
  - `DRIFTCORE_CONFIG=/path/to/driftcore.config.json npm run start:http -- --port 8080`

## HTTP endpoints (GET)

- `/health`
- `/resources`
- `/tools`
- `/project-manifest`
- `/drush/status`
- `/drush/pml`
- `/composer/info`
- `/composer/outdated`

## STDIO actions (JSON line input)

- `resources`
- `tools`
- `project_manifest`
- `drush_status`
- `drush_pml`
- `composer_info`
- `composer_outdated`

Example payload:

```json
{"id":1,"action":"project_manifest"}
```

## Docker

- Build image from package directory:
  - `docker build -t driftcore-server .`
- Run container (config mount/env needed for useful behavior):
  - `docker run --rm -p 8080:8080 -e DRIFTCORE_CONFIG=/config/driftcore.config.json -v /host/config:/config driftcore-server`

## Assumptions

- There is no root `package.json` command wrapper in the current repository.
- Docker run command is illustrative; actual Drupal/composer/drush paths must exist inside container/mounts.
