# DriftCore

DriftCore is an open-source Model Context Protocol (MCP) platform that streamlines Drupal development. The project combines a self-hosted MCP server with an agent runner that can connect to LLM-based copilots. Together they automate repetitive tasks, generate scaffolding for modules and themes, and provide guided workflows for contributing back to Drupal Core.

## Project Goals
- Accelerate Drupal 11 site building by automating boilerplate creation and configuration.
- Provide contextual helpers that translate between Drupal APIs and natural language prompts.
- Offer a local, privacy-friendly alternative to hosted AI assistants while remaining compatible with standard MCP clients.
- Encourage contributions to Drupal Core by lowering the barrier to reproducing issues, writing patches, and drafting merge requests.

## Architecture Overview
DriftCore is composed of two primary components that communicate via the MCP specification:

1. **MCP Server** (`packages/server/`)
   - Exposes Drupal-aware tools such as module scaffolding, configuration generation, and automated patch application.
   - Interfaces with the sample Drupal 11 environment through a PHP bridge and a task queue.
   - Publishes structured prompts, file diffs, and run logs that MCP clients can consume.

2. **Agent Runner** (`packages/agent-runner/`)
   - Provides a CLI and daemon mode for connecting LLM copilots (for example, Claude Desktop or VS Code extensions) to the DriftCore MCP server.
   - Manages authentication, rate limiting, and long-running tasks initiated by the server.
   - Hosts reusable prompt templates and conversation state to keep context synchronized between the user and the server.

The agent runner initiates the MCP session and relays requests from the connected copilot to the server. The server performs Drupal-aware operations and returns structured responses that the agent runner forwards back to the client. Both components are packaged as Docker images to simplify deployment.

A high-level sequence diagram:

```text
Copilot Client <-> Agent Runner <-> DriftCore MCP Server <-> Drupal 11 Environment
```

## Prerequisites
Before working with DriftCore ensure you have:

- Git 2.40+
- Node.js 20+ and pnpm 8+
- Docker 24+ and Docker Compose plugin
- PHP 8.3+ with Composer 2.6+
- Make (GNU make 4+)
- Access to an OpenAI-compatible or Anthropic-compatible LLM API key for integration tests

## Local Development Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/DriftCore.git
   cd DriftCore
   ```

2. **Install JavaScript dependencies**
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Bootstrap the MCP server**
   ```bash
   pnpm --filter server build
   pnpm --filter server dev
   ```

4. **Run the agent runner locally**
   ```bash
   pnpm --filter agent-runner build
   pnpm --filter agent-runner start
   ```

### Sample Drupal 11 Environment
DriftCore ships with a Docker-based Drupal 11 sandbox that mirrors the production toolchain used in CI. Start it with:

```bash
make drupal-env
```

This command provisions containers for:

- Drupal 11 (PHP-FPM + Nginx)
- MariaDB 10.11
- Redis for caching
- Mailhog for email testing

Access the site at http://localhost:8080 once the containers are healthy. Default credentials are `admin` / `admin`. Rebuild the environment with `make drupal-reset` to wipe the database and re-import configuration. Logs are available under `docker/logs/`.

### Configuration
- Copy `packages/server/.env.example` to `.env` and update secrets.
- Set `MCP_SERVER_URL` in `packages/agent-runner/.env` to point to your local server instance.
- Update `packages/agent-runner/config/prompts/*.md` to tailor prompt templates.

## Testing and Continuous Integration
- **Unit tests**: `pnpm test` runs JavaScript/TypeScript suites for both packages.
- **Integration tests**: `pnpm test:integration` spins up the Drupal 11 environment, executes MCP tool flows, and validates agent-runner interactions. Requires Docker and an LLM API key.
- **Linting and formatting**: `pnpm lint` and `pnpm format:check` enforce coding standards.
- **Static analysis**: `composer test` within the Drupal container runs PHPStan and PHPUnit for custom modules.

GitHub Actions (see `.github/workflows/`) execute the full test matrix on every pull request and on merges to `main`. Failing checks must be fixed before a PR can be merged.

## Contribution Guidelines
- Follow the [Drupal Coding Standards](https://www.drupal.org/docs/develop/standards) for PHP code and [TypeScript ESLint rules](https://typescript-eslint.io/rules/) for TypeScript.
- Open an issue describing proposed changes before submitting large features.
- Fork the repository, create a feature branch, and ensure all tests pass before opening a pull request.
- Use conventional commits (for example, `feat:`, `fix:`, `docs:`) and include detailed PR descriptions with screenshots where applicable.
- Reviewers expect documentation updates alongside functional changes when applicable.

## References
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Drupal 11 Documentation](https://www.drupal.org/docs/understanding-drupal/drupal-11)
- [pnpm Workspace Guide](https://pnpm.io/workspaces)
- [Docker Compose](https://docs.docker.com/compose/)

## Roadmap
Planned enhancements and open discussions are tracked in the [Roadmap board](https://github.com/your-org/DriftCore/projects/1). Upcoming initiatives include:

- Extending the agent runner with VS Code Live Share support.
- Adding automated Drupal Rector upgrades for contributed modules.
- Publishing reusable MCP tools for other PHP frameworks.

Contributions and feedback are welcome via GitHub issues and discussions.
