import assert from "node:assert/strict";
import test from "node:test";
import { attachWebGLContextGuard, canUseWebGL, scheduleSceneStart } from "../app/3d/runtime.mjs";
import { VIEWPOINTS, getViewpoint, selectQualityProfile } from "../app/3d/scene/config.mjs";
import { createTreeLayout } from "../app/3d/scene/layout.mjs";

test("WebGL capability accepts WebGL2 and rejects missing contexts", () => {
  assert.equal(canUseWebGL(() => ({ getContext: (kind) => kind === "webgl2" ? {} : null })), true);
  assert.equal(canUseWebGL(() => ({ getContext: () => null })), false);
  assert.equal(canUseWebGL(() => { throw new Error("blocked"); }), false);
});

test("scene start uses idle time and returns a working cancellation", () => {
  let callback = null;
  let cancelled = null;
  const scope = {
    requestIdleCallback(next) { callback = next; return 41; },
    cancelIdleCallback(id) { cancelled = id; },
  };
  let started = false;
  const cancel = scheduleSceneStart(() => { started = true; }, scope);
  assert.equal(started, false);
  callback();
  assert.equal(started, true);
  cancel();
  assert.equal(cancelled, 41);
});

test("scene start falls back to a short cancellable timeout", () => {
  let scheduledDelay = null;
  let cancelled = null;
  const scope = {
    setTimeout(callback, delay) { scheduledDelay = delay; callback(); return 73; },
    clearTimeout(id) { cancelled = id; },
  };
  let started = false;
  const cancel = scheduleSceneStart(() => { started = true; }, scope);
  assert.equal(started, true);
  assert.equal(scheduledDelay, 80);
  cancel();
  assert.equal(cancelled, 73);
});

test("WebGL context guard reports a loss, prevents default, and cleans up", () => {
  let handler = null;
  let removed = null;
  const canvas = {
    addEventListener(name, next) { assert.equal(name, "webglcontextlost"); handler = next; },
    removeEventListener(name, next) { assert.equal(name, "webglcontextlost"); removed = next; },
  };
  let prevented = false;
  let losses = 0;
  const detach = attachWebGLContextGuard(canvas, () => { losses += 1; });
  handler({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(losses, 1);
  detach();
  assert.equal(removed, handler);
});

test("diorama viewpoints expose four bounded editorial camera compositions", () => {
  assert.deepEqual(VIEWPOINTS.map((view) => view.id), ["arrival", "architecture", "canopy", "water"]);
  assert.deepEqual(getViewpoint("missing"), VIEWPOINTS[0]);
  for (const view of VIEWPOINTS) {
    assert.equal(view.position.length, 3);
    assert.equal(view.target.length, 3);
    assert.ok(view.position.every(Number.isFinite));
  }
});

test("mobile quality remains bounded while preserving the same scene contract", () => {
  assert.deepEqual(selectQualityProfile({ width: 390, coarsePointer: true, reducedMotion: false }), {
    tier: "mobile", dpr: [1, 1.2], trees: 34, rocks: 16, shadows: false, shadowMapSize: 512,
  });
  assert.deepEqual(selectQualityProfile({ width: 1440, coarsePointer: false, reducedMotion: false }), {
    tier: "desktop", dpr: [1, 1.6], trees: 68, rocks: 28, shadows: true, shadowMapSize: 1024,
  });
});

test("forest layout is deterministic and preserves the villa reveal corridor", () => {
  const first = createTreeLayout(68);
  assert.deepEqual(createTreeLayout(68), first);
  assert.equal(first.length, 68);

  for (const tree of first) {
    const angle = Math.atan2(tree.z / 0.82, tree.x / 1.05);
    const corridorDistance = Math.abs(Math.atan2(Math.sin(angle - 0.84), Math.cos(angle - 0.84)));
    assert.ok(corridorDistance >= 0.42, `tree entered the arrival corridor at ${corridorDistance}`);
  }
});
