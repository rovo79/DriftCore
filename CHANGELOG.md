# Changelog

## Unreleased

### Contract Changes

- Legacy startup commands are explicit: `start:http` becomes
  `start:http:legacy`, and `start:stdio:legacy` now launches
  `dist/bin/legacyStdio.js`. The custom STDIO dispatcher moves from
  `transports/stdio.js` to `transports/legacyStdio.js`. Standard MCP remains the
  `driftcore` executable. REST routes, action names, response fields, status
  values, and error codes are unchanged.

### Fixes

- Legacy action-STDIO replies are written to stdout rather than fed back into
  the readline input handler, fixing a response loop and allowing clean EOF
  shutdown. A real subprocess regression test protects this behavior.
- Builds remove stale compiled files before TypeScript emission so obsolete
  transport filenames cannot persist in packed artifacts.
