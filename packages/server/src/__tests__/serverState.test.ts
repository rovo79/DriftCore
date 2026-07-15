import assert from "node:assert/strict";
import test from "node:test";
import { createServerState } from "../serverState.js";

test("createServerState assembles resources and tools without starting a transport", () => {
  const state = createServerState({
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.ok(Array.isArray(state.resources));
  assert.ok(Array.isArray(state.tools));
  assert.equal(typeof state.runOperation, "function");
});
