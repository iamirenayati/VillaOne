// @ts-check

/**
 * @typedef {{ getContext(kind: string): unknown }} CanvasProbe
 * @typedef {{
 *   requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
 *   cancelIdleCallback?: (id: number) => void;
 *   setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
 *   clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
 * }} ScheduleScope
 * @typedef {{
 *   addEventListener(name: "webglcontextlost", listener: (event: { preventDefault(): void }) => void): void;
 *   removeEventListener(name: "webglcontextlost", listener: (event: { preventDefault(): void }) => void): void;
 * }} WebGLCanvas
 */

/**
 * @param {() => CanvasProbe} [createCanvas]
 */
export function canUseWebGL(createCanvas = () => document.createElement("canvas")) {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Defer the renderer until after the route's HTML/CSS first paint.
 * @param {() => void} callback
 * @param {ScheduleScope} [scope]
 */
export function scheduleSceneStart(callback, scope = window) {
  if (typeof scope.requestIdleCallback === "function") {
    const id = scope.requestIdleCallback(callback, { timeout: 900 });
    return () => scope.cancelIdleCallback?.(id);
  }

  const schedule = scope.setTimeout ?? setTimeout;
  const cancelSchedule = scope.clearTimeout ?? clearTimeout;
  const id = schedule(callback, 80);
  return () => cancelSchedule(id);
}

/**
 * Turn a browser-level renderer failure into a recoverable application state.
 * Preventing the default keeps browsers free to restore the context while the
 * application replaces the failed canvas with its lightweight poster.
 * @param {WebGLCanvas} canvas
 * @param {() => void} onLost
 */
export function attachWebGLContextGuard(canvas, onLost) {
  const handleContextLoss = (event) => {
    event.preventDefault();
    onLost();
  };

  canvas.addEventListener("webglcontextlost", handleContextLoss);
  return () => canvas.removeEventListener("webglcontextlost", handleContextLoss);
}
