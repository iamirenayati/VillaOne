# VillaOne Hyrcanian Diorama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated `/3d` route containing a performant, accessible, art-directed Hyrcanian forest villa diorama without changing the existing map or backend.

**Architecture:** A server-rendered route provides metadata, navigation, conceptual copy, and an immediate fallback. A client experience gate capability-checks WebGL and lazy-loads a route-local React Three Fiber canvas. The canvas composes focused scene components for camera, terrain, villa, vegetation, and lighting; semantic HTML controls remain outside WebGL.

**Tech Stack:** Vinext/Next app router, React 19.2.6, TypeScript, CSS Modules, Three.js 0.185.1, React Three Fiber 9.7.0, Drei 10.7.8, Node's built-in test runner.

## Global Constraints

- Frontend only: do not modify Django models, APIs, settings, migrations, or data.
- Preserve `/map`, its MapLibre implementation, and all existing public routes.
- `/3d` is one fictional conceptual villa, not a real listing or booking surface.
- Use Persian/RTL interface copy while keeping the navigation label exactly `3D`.
- Keep Three.js imports inside the `/3d` route; shared layout and navigation may not import 3D libraries.
- First paint must be useful HTML/CSS and must not wait for WebGL.
- Do not add physics, GSAP, post-processing packages, remote models, map tiles, API keys, sound, pointer lock, or fullscreen requests.
- Mouse, touch, keyboard, reduced-motion, WebGL failure, and mobile quality states are required.
- Use on-demand rendering, bounded DPR, instancing, shared materials/geometries, and static atmospheric details.
- Use the direct verified npm CLI on this workstation: `& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'`.

## File Structure

- `app/components/PublicHeader.tsx` — add the single shared `3D` navigation entry.
- `app/3d/page.tsx` — server route, metadata, overlay header, and experience mount.
- `app/3d/DioramaExperience.tsx` — client state, lazy boundary, accessible controls, loading and recovery UI.
- `app/3d/DioramaErrorBoundary.tsx` — catches scene/render errors and exposes retry.
- `app/3d/DioramaPoster.tsx` — HTML/CSS illustrated fallback that works without WebGL.
- `app/3d/Diorama.module.css` — page, overlay UI, fallback illustration, responsive and reduced-motion styles.
- `app/3d/runtime.mjs` — testable WebGL capability and deferred-start helpers.
- `app/3d/scene/config.mjs` — deterministic camera viewpoints and quality profiles.
- `app/3d/scene/DioramaCanvas.tsx` — route-local Canvas configuration and lifecycle bridge.
- `app/3d/scene/CameraRig.tsx` — bounded orbit controls and interruptible camera transitions.
- `app/3d/scene/HyrcanianWorld.tsx` — lighting, fog, terrain, water, and scene assembly.
- `app/3d/scene/VillaSculpture.tsx` — original modern-villa geometry and materials.
- `app/3d/scene/ForestInstances.tsx` — deterministic instanced trees, shrubs, rocks, and light motes.
- `tests/rendered-html.test.mjs` — route/navigation behavior and `/map` preservation.
- `tests/three-runtime.test.mjs` — capability, deferred loading, quality, and viewpoint contracts.
- `package.json`, `package-lock.json` — locked Three.js dependencies.

---

### Task 1: Public route and shared navigation

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/components/PublicHeader.tsx`
- Create: `app/3d/page.tsx`
- Create: `app/3d/DioramaExperience.tsx`
- Create: `app/3d/DioramaPoster.tsx`
- Create: `app/3d/Diorama.module.css`

**Interfaces:**
- Consumes: existing `PublicHeader({ variant: "surface" | "overlay" })`.
- Produces: server-rendered `/3d` page and `DioramaExperience(): JSX.Element` client mount for later tasks.

- [ ] **Step 1: Extend the render helper and write the failing route test**

Change the helper to accept a pathname and add an acceptance test against real rendered HTML:

```js
async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("3D route renders a truthful conceptual experience and shared navigation", async () => {
  const response = await render("/3d");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /جنگل هیرکانی، بازآفرینی‌شده/);
  assert.match(html, /تجربه مفهومی/);
  assert.match(html, /در حال آماده‌سازی جنگل/);
  assert.match(html, /href="\/3d"/);
  assert.match(html, /href="\/map"/);
  assert.match(html, /href="\/villas"/);
  assert.doesNotMatch(html, /قیمت|رزرو این ویلا|موقعیت دقیق/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test --test-name-pattern "3D route" tests/rendered-html.test.mjs
```

Expected: FAIL because `/3d` does not exist or does not contain the conceptual experience.

- [ ] **Step 3: Add the shared navigation entry**

Insert the new route without removing the practical map:

```tsx
const links = [
  ["/map", "نقشه"],
  ["/3d", "3D"],
  ["/villas", "ویلاها"],
  ["/real-estate", "املاک"],
  ["/contractors", "پیمانکاران"],
  ["/services", "خدمات سفر"],
  ["/journal", "مجله"],
] as const;
```

- [ ] **Step 4: Implement the minimal server-rendered route shell**

Create `app/3d/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PublicHeader } from "../components/PublicHeader";
import { DioramaExperience } from "./DioramaExperience";
import styles from "./Diorama.module.css";

export const metadata: Metadata = {
  title: "تجربه سه‌بعدی جنگل هیرکانی | ویلاوان",
  description: "یک ویلای مفهومی در میان جنگل هیرکانی؛ تجربه‌ای تعاملی از معماری و طبیعت ویلاوان.",
};

export default function HyrcanianDioramaPage() {
  return (
    <main className={styles.page} dir="rtl">
      <PublicHeader variant="overlay" />
      <DioramaExperience />
    </main>
  );
}
```

Create the initial `DioramaExperience` without importing Three.js:

```tsx
"use client";

import Link from "next/link";
import { DioramaPoster } from "./DioramaPoster";
import styles from "./Diorama.module.css";

export function DioramaExperience() {
  return (
    <section className={styles.experience} aria-labelledby="diorama-title">
      <div className={styles.canvasSlot}><DioramaPoster /></div>
      <div className={styles.editorial}>
        <p className={styles.conceptLabel}>تجربه مفهومی</p>
        <h1 id="diorama-title">جنگل هیرکانی، بازآفرینی‌شده</h1>
        <p>یک ویلای خیالی؛ روایتی از معماری آرام در میان جنگل شمال.</p>
        <p role="status" aria-live="polite">در حال آماده‌سازی جنگل…</p>
        <Link href="/villas">مشاهده ویلاهای واقعی</Link>
      </div>
    </section>
  );
}
```

Create the poster as semantic-free decorative geometry:

```tsx
import styles from "./Diorama.module.css";

export function DioramaPoster() {
  return (
    <div className={styles.poster} aria-hidden="true">
      <span className={styles.posterMist} />
      <span className={styles.posterIsland} />
      <span className={styles.posterVilla}><i /><i /><i /></span>
      <span className={styles.posterTrees}><i /><i /><i /><i /><i /></span>
      <span className={styles.posterWater} />
    </div>
  );
}
```

- [ ] **Step 5: Add the stable visual shell**

In `Diorama.module.css`, define a full-height fixed-composition page with these non-negotiable rules:

```css
.page {
  --forest-950: #06130f;
  --forest-900: #0a2018;
  --forest-700: #23483a;
  --ivory: #f4ecdf;
  --bronze: #d2a05d;
  min-height: 100svh;
  position: relative;
  isolation: isolate;
  overflow: clip;
  color: var(--ivory);
  background: var(--forest-950);
}

.experience { min-height: 100svh; position: relative; display: grid; }
.canvasSlot { position: absolute; inset: 0; min-height: 100svh; }
.editorial { position: absolute; z-index: 5; inset-inline-end: clamp(1.25rem, 5vw, 5rem); bottom: clamp(7.5rem, 12vh, 10rem); max-width: 34rem; }
.page :is(a, button):focus-visible { outline: 3px solid var(--bronze); outline-offset: 4px; }

@media (max-width: 720px) {
  .experience, .canvasSlot { min-height: 100dvh; }
  .editorial { inset-inline: 1rem; bottom: calc(8.5rem + env(safe-area-inset-bottom)); }
}
```

The poster must be original HTML/CSS geometry, not a stock image or external asset.

- [ ] **Step 6: Build, rerun the test, and verify GREEN**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
& 'C:\Program Files\nodejs\node.exe' --test --test-name-pattern "3D route" tests/rendered-html.test.mjs
```

Expected: build succeeds, `/3d` appears in route output, and the focused test passes.

- [ ] **Step 7: Commit the route shell**

```powershell
git add app/3d app/components/PublicHeader.tsx tests/rendered-html.test.mjs
git commit -m "feat: add the Hyrcanian 3D experience shell"
```

---

### Task 2: Capability gate, deferred loading, and locked dependencies

**Files:**
- Create: `tests/three-runtime.test.mjs`
- Create: `app/3d/runtime.mjs`
- Create: `app/3d/DioramaErrorBoundary.tsx`
- Create: `app/3d/scene/DioramaCanvas.tsx`
- Modify: `app/3d/DioramaExperience.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `canUseWebGL(createCanvas?)`, `scheduleSceneStart(callback, scope?)`, `DioramaCanvasProps`, and a retryable error boundary.
- `DioramaCanvasProps`: `{ request: CameraRequest; quality: QualityProfile; reducedMotion: boolean; onReady(): void; onContextLost(): void; onInteract(): void }`.

- [ ] **Step 1: Write failing runtime behavior tests**

Create `tests/three-runtime.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { canUseWebGL, scheduleSceneStart } from "../app/3d/runtime.mjs";

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
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/three-runtime.test.mjs
```

Expected: FAIL because `app/3d/runtime.mjs` does not exist.

- [ ] **Step 3: Implement the minimal runtime helpers**

Create `app/3d/runtime.mjs` with dependency injection so tests exercise real behavior:

```js
// @ts-check
export function canUseWebGL(createCanvas = () => document.createElement("canvas")) {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function scheduleSceneStart(callback, scope = window) {
  if (typeof scope.requestIdleCallback === "function") {
    const id = scope.requestIdleCallback(callback, { timeout: 900 });
    return () => scope.cancelIdleCallback?.(id);
  }
  const id = scope.setTimeout(callback, 80);
  return () => scope.clearTimeout(id);
}
```

Add precise JSDoc typedefs for the injected canvas and scheduling scope so TypeScript remains strict.

- [ ] **Step 4: Install the verified compatible dependency versions**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' install three@0.185.1 @react-three/fiber@9.7.0 @react-three/drei@10.7.8
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' install --save-dev @types/three@0.185.4
```

Do not run `npm audit fix`; the existing dependency audit is outside this feature and may introduce breaking upgrades.

- [ ] **Step 5: Add the lazy client boundary and error recovery**

In `DioramaExperience.tsx`, construct the lazy component through a factory so retry creates a new import boundary:

```tsx
const createCanvasModule = () => lazy(() => import("./scene/DioramaCanvas").then((module) => ({ default: module.DioramaCanvas })));

const [CanvasModule, setCanvasModule] = useState(createCanvasModule);
const [runtimeState, setRuntimeState] = useState<"waiting" | "loading" | "ready" | "unsupported" | "lost">("waiting");

useEffect(() => scheduleSceneStart(() => {
  setRuntimeState(canUseWebGL() ? "loading" : "unsupported");
}), []);

function retryScene() {
  setCanvasModule(() => createCanvasModule());
  setRuntimeState(canUseWebGL() ? "loading" : "unsupported");
}
```

`DioramaErrorBoundary` must accept `{ resetKey: number; onError(): void; children: ReactNode }`, clear its error when `resetKey` changes, and render the same truthful fallback instead of a blank canvas.

- [ ] **Step 6: Add a minimal route-local Canvas**

Create `DioramaCanvas.tsx` with a route-only import boundary:

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

export function DioramaCanvas({ onReady }: DioramaCanvasProps) {
  return (
    <Canvas
      aria-label="نمای سه‌بعدی ویلای مفهومی در جنگل هیرکانی"
      frameloop="demand"
      camera={{ position: [12, 8, 15], fov: 38, near: 0.1, far: 80 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#06130f"]} />
        <ambientLight intensity={0.7} />
        <mesh onAfterRender={onReady}>
          <boxGeometry args={[3, 1.5, 3]} />
          <meshStandardMaterial color="#d7cdbb" />
        </mesh>
      </Suspense>
    </Canvas>
  );
}
```

Define `DioramaCanvasProps` in this file from the plan interface and guard `onReady` with a ref so it fires once. Later tasks replace the minimal mesh.

- [ ] **Step 7: Verify runtime tests, build, and route test**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/three-runtime.test.mjs
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test
```

Expected: runtime tests pass; production build and all rendered-HTML tests pass.

- [ ] **Step 8: Commit the route-local runtime**

```powershell
git add package.json package-lock.json app/3d tests/three-runtime.test.mjs
git commit -m "feat: lazy-load the Three.js diorama runtime"
```

---

### Task 3: Deterministic scene, quality profiles, and original art direction

**Files:**
- Create: `app/3d/scene/config.mjs`
- Create: `app/3d/scene/HyrcanianWorld.tsx`
- Create: `app/3d/scene/VillaSculpture.tsx`
- Create: `app/3d/scene/ForestInstances.tsx`
- Modify: `app/3d/scene/DioramaCanvas.tsx`
- Modify: `tests/three-runtime.test.mjs`

**Interfaces:**
- Produces: `VIEWPOINTS`, `getViewpoint(id)`, `selectQualityProfile(input)`, `QualityProfile`, and the static `HyrcanianWorld` scene.
- Quality input: `{ width: number; coarsePointer: boolean; reducedMotion: boolean }`.
- Quality result: `{ tier: "mobile" | "desktop"; dpr: [number, number]; trees: number; rocks: number; shadows: boolean; shadowMapSize: number }`.

- [ ] **Step 1: Write failing deterministic configuration tests**

Append:

```js
import { VIEWPOINTS, getViewpoint, selectQualityProfile } from "../app/3d/scene/config.mjs";

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
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/three-runtime.test.mjs
```

Expected: FAIL because `scene/config.mjs` does not exist.

- [ ] **Step 3: Implement the exact quality and viewpoint contract**

Use these composed views in `config.mjs`:

```js
export const VIEWPOINTS = Object.freeze([
  { id: "arrival", label: "ورود", description: "نمای اصلی", position: [11.8, 7.1, 14.2], target: [0, 1.4, 0] },
  { id: "architecture", label: "معماری", description: "تراس و نور", position: [8.1, 4.7, 8.4], target: [0.3, 1.6, -0.2] },
  { id: "canopy", label: "سایه‌سار", description: "جنگل از بالا", position: [-8.8, 11.5, 12.4], target: [0, 0.8, 0] },
  { id: "water", label: "آب", description: "انعکاس آرام", position: [-10.6, 4.2, 7.7], target: [-0.8, 0.6, 1.3] },
]);
```

Return the mobile profile when `width < 760 || coarsePointer`, otherwise desktop. Reduced motion changes animation behavior, not scene identity.

- [ ] **Step 4: Build the original villa sculpture**

`VillaSculpture` composes shared box geometries and physically plausible materials:

- Stone plinth at `[0, 0.45, 0]`, size `[6.8, 0.8, 5.2]`.
- Lower ivory volume at `[-0.6, 1.45, 0.2]`, size `[5.4, 1.7, 4.1]`.
- Upper charcoal volume at `[0.65, 2.75, -0.35]`, size `[4.8, 1.35, 3.5]`.
- Bronze-framed glass wall on the front elevation with emissive amber material.
- Cantilevered roof slab, terrace, vertical timber screen, and three warm interior area/point lights.
- All meshes set `castShadow`/`receiveShadow` from the quality profile rather than assuming desktop.

Do not use randomized dimensions or external textures. The silhouette must remain identical across renders.

- [ ] **Step 5: Build deterministic instanced vegetation**

Use a fixed seeded generator in `ForestInstances.tsx`:

```ts
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
```

Populate positions in an annulus around the protected villa clearing. Use `THREE.InstancedMesh` for trunks and two canopy layers, reuse one `Object3D` transform helper, and set matrices once in `useLayoutEffect`. Exclude coordinates inside the villa/pool footprint. Use the quality profile's exact tree and rock counts.

- [ ] **Step 6: Assemble Emerald Dusk**

`HyrcanianWorld` must include:

```tsx
<color attach="background" args={["#06130f"]} />
<fogExp2 attach="fog" args={["#0a2119", 0.034]} />
<hemisphereLight args={["#769386", "#07120e", 1.5]} />
<directionalLight position={[8, 12, 6]} intensity={2.1} color="#e7d4ad" castShadow={quality.shadows} />
```

Add three layered low-poly terrain cylinders, a still `meshPhysicalMaterial` water plane, the villa, instanced vegetation, and static amber motes. Avoid a continuous animation loop.

- [ ] **Step 7: Replace the temporary mesh and verify**

Mount `HyrcanianWorld` in `DioramaCanvas`, pass the quality profile, retain `frameloop="demand"`, and run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/three-runtime.test.mjs
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
```

Expected: runtime/config tests pass and the production build succeeds.

- [ ] **Step 8: Commit the art-directed world**

```powershell
git add app/3d/scene tests/three-runtime.test.mjs
git commit -m "feat: sculpt the Hyrcanian forest villa world"
```

---

### Task 4: Living Sculpture camera and accessible controls

**Files:**
- Create: `app/3d/scene/CameraRig.tsx`
- Modify: `app/3d/scene/DioramaCanvas.tsx`
- Modify: `app/3d/DioramaExperience.tsx`
- Modify: `app/3d/Diorama.module.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `VIEWPOINTS`, `getViewpoint`, `QualityProfile`.
- Produces: `CameraRequest = { id: string; sequence: number }` and `CameraRig({ request, reducedMotion, onInteract })`.

- [ ] **Step 1: Write the failing rendered control test**

Add:

```js
test("3D experience exposes keyboard camera views and recovery controls", async () => {
  const response = await render("/3d");
  const html = await response.text();
  assert.match(html, /aria-label="زاویه‌های دید"/);
  assert.match(html, />ورود</);
  assert.match(html, />معماری</);
  assert.match(html, />سایه‌سار</);
  assert.match(html, />آب</);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /بازگشت به نمای اصلی/);
  assert.match(html, /ماوس|لمس|کلید/);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test --test-name-pattern "keyboard camera" tests/rendered-html.test.mjs
```

Expected: FAIL because the semantic camera dock is absent.

- [ ] **Step 3: Add semantic controls outside the canvas**

In `DioramaExperience`, initialize:

```tsx
const [cameraRequest, setCameraRequest] = useState({ id: "arrival", sequence: 0 });
const [manualCamera, setManualCamera] = useState(false);

function requestView(id: string) {
  setManualCamera(false);
  setCameraRequest((current) => ({ id, sequence: current.sequence + 1 }));
}
```

Render one `<button>` per `VIEWPOINTS`, use `aria-pressed={!manualCamera && cameraRequest.id === view.id}`, and add a separate reset button labeled `بازگشت به نمای اصلی`. Keep all buttons in a real `<nav aria-label="زاویه‌های دید">`.

- [ ] **Step 4: Implement bounded OrbitControls and camera interpolation**

`CameraRig` must use `OrbitControls` with:

```tsx
<OrbitControls
  ref={controlsRef}
  enablePan={false}
  enableDamping
  dampingFactor={0.07}
  minDistance={8.5}
  maxDistance={19}
  minPolarAngle={0.72}
  maxPolarAngle={1.38}
  minAzimuthAngle={-1.25}
  maxAzimuthAngle={1.05}
  onStart={onInteract}
/>
```

On each camera request, interpolate `camera.position` and `controls.target` toward the configured vectors with `1 - Math.exp(-delta * 4.2)`. Call `invalidate()` until both distances are below `0.015`, then stop. Reduced motion copies the target vectors immediately. User drag cancels the active transition.

- [ ] **Step 5: Add the entrance and interaction guidance**

Start the non-reduced-motion camera at `[15.5, 10.8, 19.5]` and request `arrival` after the first ready frame. Show concise guidance until the first camera interaction. Do not auto-rotate.

- [ ] **Step 6: Style desktop and mobile control layouts**

Use a translucent dark dock with a one-pixel bronze active indicator, not rounded SaaS cards. On mobile, use:

```css
@media (max-width: 720px) {
  .viewDock {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    display: flex;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
  }
  .viewDock button { min-width: 7rem; min-height: 3rem; flex: 0 0 auto; }
}

@media (prefers-reduced-motion: reduce) {
  .canvas, .poster, .statusPanel, .viewDock button { transition: none; animation: none; }
}
```

- [ ] **Step 7: Verify tests, type safety, and lint**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run lint
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

Expected: all tests and build pass, lint has no errors, and TypeScript exits zero.

- [ ] **Step 8: Commit the interactive camera system**

```powershell
git add app/3d tests/rendered-html.test.mjs
git commit -m "feat: add accessible Living Sculpture controls"
```

---

### Task 5: Lifecycle recovery, responsive quality, and browser acceptance

**Files:**
- Modify: `app/3d/scene/DioramaCanvas.tsx`
- Modify: `app/3d/DioramaExperience.tsx`
- Modify: `app/3d/Diorama.module.css`
- Modify: `tests/three-runtime.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: runtime capability helpers and quality profiles.
- Produces: reliable context-loss recovery, route cleanup, final mobile/desktop experience.

- [ ] **Step 1: Add a failing fallback-scheduler test**

Extend the scheduler test with a scope that has no idle callback:

```js
test("scene start falls back to a cancellable timeout", () => {
  let scheduled = null;
  let cleared = null;
  const scope = {
    setTimeout(callback, delay) { scheduled = { callback, delay }; return 9; },
    clearTimeout(id) { cleared = id; },
  };
  const cancel = scheduleSceneStart(() => {}, scope);
  assert.equal(scheduled.delay, 80);
  cancel();
  assert.equal(cleared, 9);
});
```

- [ ] **Step 2: Run and verify RED if the fallback is incomplete**

Run `node --test tests/three-runtime.test.mjs`. Expected: FAIL only if the timeout contract is not already complete; if it passes, perform the mutation check by temporarily changing `80` to `81`, verify failure, and restore before continuing.

- [ ] **Step 3: Add renderer context lifecycle handling**

Inside the Canvas tree, add a focused component that gets `gl.domElement` from `useThree`, attaches `webglcontextlost`, calls `event.preventDefault()` and `onContextLost()`, and removes the listener in its effect cleanup. Retrying increments the Canvas key and creates a fresh renderer.

- [ ] **Step 4: Select quality from real client capabilities**

In `DioramaExperience`, derive the profile after mount from:

```ts
selectQualityProfile({
  width: window.innerWidth,
  coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});
```

Subscribe to both media-query changes and debounced resize; remove every listener/timer on unmount. Pass the profile's DPR and shadow settings to Canvas/world.

- [ ] **Step 5: Complete truthful states**

- `waiting/loading`: poster remains visible with `role="status"`, `aria-busy="true"`, and no fake percentage.
- `ready`: canvas fades in and poster fades out without being removed before the first frame.
- `unsupported`: explain that interactive 3D is unavailable and keep links to `/villas` and `/map`.
- `lost/error`: show retry once and preserve the static poster after repeated failure.
- Every state remains navigable without canvas input.

- [ ] **Step 6: Run browser acceptance at 390px and 1440px**

Start the app:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run dev
```

Verify in a real browser:

- `/3d` loads without console errors and the first paint is the HTML/CSS poster.
- Canvas replaces the poster only after ready.
- Drag, touch emulation, wheel zoom, each viewpoint, reset, and transition interruption work.
- Camera limits never show empty world edges or enter geometry.
- Tab order reaches navigation, all viewpoints, reset, fallback links, and account controls.
- Reduced-motion emulation skips the entrance and removes transitions.
- At 390px there is no horizontal page overflow or safe-area collision.
- At 1440px title, dock, and shared header do not collide.
- Leaving `/3d` disposes the canvas; returning creates one renderer, not duplicates.
- `/map` still loads its practical MapLibre interface.

- [ ] **Step 7: Measure route isolation and idle behavior**

Record the production build route/chunk output and a browser performance trace. The accepted result must show:

- Three.js chunks requested only after navigating to `/3d`.
- No Three.js request on `/`, `/villas`, or `/map` initial load.
- No continuous main-thread render task once the camera has settled.
- No unexpected layout shift when the canvas appears.

If a proposed optimization does not improve these measured behaviors, revert it rather than keeping neutral complexity.

- [ ] **Step 8: Run final automated gates**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run lint
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
git diff --check
git status --short
```

Expected: build and all tests pass; lint has zero errors; TypeScript exits zero; no whitespace errors; only intended files are changed.

- [ ] **Step 9: Commit final reliability and polish**

```powershell
git add app/3d tests
git commit -m "fix: harden the 3D experience across devices"
```

---

### Task 6: Final review and handoff

**Files:**
- Review only: all changed files on `feature/hyrcanian-3d`.

**Interfaces:**
- Produces: review evidence, clean branch state, and precise integration instructions.

- [ ] **Step 1: Review the complete branch diff**

Run:

```powershell
git diff 6415f8e...HEAD --stat
git diff 6415f8e...HEAD -- app tests package.json package-lock.json
```

Review for scope drift, unsafe imports, hidden backend/data coupling, unbounded animation, missing cleanup, inaccessible controls, and accidental changes to `/map`.

- [ ] **Step 2: Apply the code-review skill and fix only confirmed findings**

Every confirmed behavioral issue gets a failing regression test before its fix. Do not perform unrelated cleanup.

- [ ] **Step 3: Re-run verification after review fixes**

Run the full test, lint, TypeScript, and production-build gates once after the final code change. Capture exact pass counts and any pre-existing warnings separately from new warnings.

- [ ] **Step 4: Confirm clean history and workspace**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -8
```

Expected: clean `feature/hyrcanian-3d` worktree with atomic design, route, runtime, scene, interaction, and reliability commits.
