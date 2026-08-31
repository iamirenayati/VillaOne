# VillaOne Hyrcanian Diorama — Design Specification

- **Date:** 2026-08-18
- **Status:** Approved for implementation
- **Route:** `/3d`
- **Scope:** Frontend only

## Objective

Add a self-contained, art-directed Three.js experience to VillaOne without changing the practical `/map` page, villa data, booking logic, or backend APIs. The new navigation tab presents one fictional showcase villa as a tactile architectural sculpture inside a stylized Hyrcanian forest.

The experience should feel like luxury digital architecture rather than a game, a generic product viewer, or an AI-generated landscape. Its purpose is brand expression and memorable discovery, not geographic navigation.

## Approved Direction

- **World:** Hyrcanian Diorama — a handcrafted architectural maquette with sculpted terrain, layered trees, water, mist, and a warm modern villa.
- **Interaction:** Living Sculpture — a brief composed opening shot followed by constrained orbit controls and four curated viewpoints.
- **Atmosphere:** Emerald Dusk — deep forest greens, bronze light, soft fog, and restrained water reflections.
- **Content:** Fictional showcase only. It does not represent a real villa, availability, price, or exact location.
- **Language:** Persian/RTL interface, with the navigation label `3D` as requested.

## Inspiration and Translation

The design takes strategic inspiration from:

- The custom-model, cinematic-camera, luxury-resort approach documented in the [Maldives Resort case study](https://www.meesakveld.be/en/work/web-development/maldives-resort).
- The dreamlike, hand-authored woodland experience of [Way to Go](https://experiments.withgoogle.com/way-to-go).
- The atmospheric depth and fog techniques demonstrated in the [official Three.js examples](https://threejs.org/examples/?q=fog).

No layout, asset, model, shader, or scene will be copied. VillaOne's scene will use an original composition and the existing forest, ivory, and bronze visual identity.

## Scene Composition

The scene is a contained floating landscape rather than an infinite world:

1. A terraced, irregular forest island forms the base.
2. A fictional two-level modern villa sits slightly off-center, oriented for a strong three-quarter opening view.
3. Warm emissive glass makes the villa the visual anchor.
4. A narrow reflective pool or forest stream creates a quiet secondary focal line.
5. Layered conifer and broadleaf silhouettes create foreground framing and background depth.
6. Sparse stones, low shrubs, and small amber particles provide scale without visual clutter.
7. Exponential fog and a deep green background hide the edge of the diorama and soften distant geometry.

Geometry will be intentionally stylized: clean planes, strong silhouettes, restrained material variation, and no synthetic photoreal textures. The villa, terrain, trees, rocks, water, and props will be authored as reusable scene components.

## Camera and Interaction

### Entrance

- The route renders an immediate lightweight HTML/CSS loading composition.
- Once WebGL is ready, the camera performs a short 2–3 second approach toward the hero view.
- Reduced-motion users skip the camera animation and start at the settled hero view.

### Exploration

- Pointer drag and touch drag orbit around a fixed architectural target.
- Rotation, polar angle, and zoom are constrained to preserve composition and prevent users from entering geometry or seeing unfinished edges.
- Wheel/pinch zoom is bounded.
- Panning and first-person movement are disabled.
- A visible reset control returns to the hero view.
- The scene never auto-rotates after user input.

### Curated viewpoints

Four semantic HTML controls move the camera to composed views:

1. **Arrival** — villa and approach path.
2. **Architecture** — facade, terraces, and warm interior planes.
3. **Canopy** — higher forest-and-villa composition.
4. **Water** — pool/stream reflection and landscape edge.

Each control is keyboard reachable and exposes an active state. Camera transitions are interruptible: dragging immediately returns control to the visitor.

## Interface Layout

- Reuse the shared `PublicHeader` as a transparent overlay that becomes legible over the dark scene.
- Add `/3d` to the shared desktop and mobile navigation with reliable active-route behavior.
- Keep the existing `/map` navigation item unchanged.
- Place a compact editorial title block at the lower right on desktop and above the mobile control sheet:
  - `جنگل هیرکانی، بازآفرینی‌شده`
  - A concise sentence stating this is a conceptual VillaOne experience.
- Place camera/view controls in a slim lower dock on desktop and a horizontally scrollable bottom sheet on mobile.
- Include short interaction guidance that disappears after first interaction but remains available through an information control.
- Label the scene clearly as `تجربه مفهومی` so it cannot be mistaken for a real listing.

## Technical Direction

Install only the focused React/Three.js stack:

- `three`
- `@react-three/fiber` v9-compatible with React 19
- `@react-three/drei`
- `@types/three` as a development dependency when required by the installed Three.js package

Do not add a physics engine, GSAP, a post-processing framework, Blender runtime, map SDK, external tiles, or remote 3D service.

The scene will be implemented with procedural/reusable geometry rather than an external GLB for this first version. This keeps the artistic composition editable in code and avoids an opaque asset pipeline. If a custom Blender model is introduced later, glTF/GLB is the preferred runtime format according to the [Three.js model-loading guidance](https://threejs.org/manual/en/loading-3d-models.html).

## Loading and Bundle Isolation

- The Three.js canvas and all 3D dependencies must load only on `/3d` through a client-only dynamic boundary.
- No Three.js module may enter the homepage, shared header, practical map, or other public route bundles.
- First paint is HTML/CSS and must not wait for WebGL or scene modules.
- The loading state reserves the final canvas dimensions to prevent layout shift.
- A WebGL capability failure or scene exception displays an art-directed static fallback with retry; it never leaves a blank canvas.
- WebGL resources, controls, observers, and timers are disposed when leaving the route.

## Rendering and Performance Budget

- Prefer React Three Fiber's on-demand rendering. Camera transitions explicitly invalidate frames; the settled scene becomes idle.
- Use instancing for repeated trees and rocks.
- Reuse geometries and materials instead of cloning them per object.
- Cap device pixel ratio by quality tier; do not render unbounded native DPR.
- Desktop may use soft shadows and a larger vegetation count.
- Mobile reduces vegetation, particles, shadow resolution, and DPR while retaining the same composition.
- Reduced-motion mode removes entrance animation and atmospheric particle movement.
- Use tone mapping, lighting, fog, materials, and a CSS vignette instead of a heavy post-processing chain.
- Avoid continuous animation whose only purpose is decoration.

The existing build already warns about large shared chunks, so route-level separation is a release requirement, not an optional optimization. React Three Fiber's official [performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) supports on-demand rendering, adaptive DPR, instancing, and quality regression.

## Accessibility and Input Safety

- The canvas receives a meaningful accessible label, while all actions remain real HTML controls.
- Keyboard users can select every viewpoint and reset the scene without manipulating the canvas.
- Visible focus styling must meet the existing public-interface standard.
- Touch targets are at least 44px.
- Instructions cover mouse, touch, and keyboard use.
- `prefers-reduced-motion` produces a stable scene with immediate camera changes or short fades.
- Color contrast is preserved independently of the canvas by placing text on translucent solid surfaces.
- The experience does not autoplay sound and does not request fullscreen or pointer lock.

## Responsive Behavior

- **Desktop:** full-bleed scene under the shared header; title block at lower right; compact viewpoint dock at lower left/center.
- **Tablet:** slightly reduced scene complexity; controls remain overlaid but wrap safely.
- **Mobile:** full-height scene with a stable minimum height, simplified renderer settings, title above a bottom control sheet, safe-area padding, and no horizontal page overflow.
- Orientation and resize changes update the camera and renderer without recreating the full scene unnecessarily.

## Failure and Fallback States

- **Preparing:** branded illustrated scene placeholder, progress wording, no fake percentage.
- **Ready:** canvas fades in only after the first complete frame.
- **WebGL unavailable:** static illustrated diorama, explanation, and link back to villas.
- **Scene load failure:** retry button reconstructs the client scene once; persistent failure keeps the static fallback usable.
- **Context lost:** show recovery state and attempt a controlled renderer rebuild rather than reloading the entire site.

## Testing and Acceptance

### Automated

- Rendered-HTML tests verify the `/3d` route shell, conceptual label, loading/fallback content, and shared navigation link.
- Tests verify the practical `/map` route remains present and its implementation references are unchanged.
- Lint and production build must pass.
- The build output must show `/3d` as its own route, with no static import of Three.js from shared navigation or root layout files.

### Browser acceptance

- Verify at 390px and 1440px.
- Confirm loading, WebGL success, WebGL failure fallback, retry, reduced motion, and context cleanup.
- Confirm drag, touch, wheel/pinch, keyboard viewpoint selection, reset, and interruption of camera transitions.
- Confirm no camera path exposes empty space, penetrates the villa, or crosses the terrain.
- Confirm no horizontal overflow, header collision, clipped controls, console errors, or interaction traps.
- Inspect main-thread and GPU behavior after the scene becomes idle.

## Explicit Non-goals

- No backend/API/model changes.
- No real villa, coordinate, availability, pricing, or booking data.
- No replacement of `/map`.
- No first-person movement, collision physics, character, game mechanics, or audio.
- No external 3D/map provider, API key, remote tiles, or runtime model marketplace.
- No WebGPU-only implementation; V1 uses broadly compatible WebGL.

## Definition of Done

The feature is complete when `/3d` feels like a coherent VillaOne art piece, remains optional and isolated, loads without blocking first paint, offers bounded mouse/touch/keyboard exploration, has a truthful fallback, leaves all existing routes unaffected, and passes the frontend production gates.
