# Drupal 11 Sandbox

This Docker Compose environment provisions a minimal Drupal 11 site backed by MariaDB. It mirrors the resources exposed by the DriftCore MCP server and is intended for local experimentation.

## Prerequisites

- Docker
- Docker Compose v2

## Usage

```bash
cd examples/drupal-sandbox
docker compose up --build
```

Once the containers are running, visit [http://localhost:8081](http://localhost:8081) to complete Drupal's installation wizard.

The configuration export directory is mounted at `examples/drupal-sandbox/config/sync` and seeded with the same configuration that is exposed through the MCP server's `config.exported` resource.

## Maintenance

- To rebuild after editing configuration run `docker compose build drupal`.
- Run Drush commands inside the container with `docker compose exec drupal drush status`.
- Use `docker compose down --volumes` to reset the database and configuration.
