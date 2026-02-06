# TESTING

- **Primary test entrypoints**
  - `npm test` (from `packages/server`): build then run Node tests from compiled `dist/__tests__`.
  - `npm run integration`: build then run HTTP transport smoke test (`dist/integration/smoke.js`).
  - `npm run lint`: TypeScript type-check in no-emit mode.

## Test suites in `packages/server/src`

- `__tests__/projectManifest.test.ts`
  - Valid manifest generation, not-configured behavior, degraded behavior on missing composer metadata.
- `__tests__/cliTools.test.ts`
  - Drush status parsing, Drush pml normalization, composer info parsing, composer outdated parsing.
- `__tests__/cliTools.nonwrite.test.ts`
  - Verifies tool invocations do not modify a sentinel project file.
- `__tests__/schemaResources.test.ts`
  - Verifies required static schema resources and drush tool registration.
- `integration/smoke.ts`
  - Starts ephemeral HTTP server and calls core endpoints (`/health`, `/resources`, `/project-manifest`, `/drush/status`, `/composer/info`).

## Testing characteristics

- Uses temporary directories to simulate Drupal project filesystem shape.
- Avoids requiring real Drush/Composer execution in unit tests by using runner stubs.
- Integration smoke test validates transport plumbing but does not assert real Drupal connectivity.

## Gaps / what to add next

- No property/fuzz tests for parsing untrusted CLI output.
- No contract tests for schema versioning backward compatibility.
- No CI config in repo to enforce test execution on PRs.

## Assumptions

- Test commands are package-local; there is no root-level test orchestrator currently checked in.
- “Integration” here means HTTP transport smoke coverage, not full Drupal sandbox integration.
