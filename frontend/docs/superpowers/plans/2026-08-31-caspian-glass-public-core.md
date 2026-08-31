# VillaOne Caspian Glass Public Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Caspian Glass design foundation, shared public navigation, homepage, villa catalogue and villa detail as a production-ready responsive milestone without changing backend behavior.

**Architecture:** Keep the existing Next.js/Vinext App Router, API helpers and domain components. Add global semantic tokens and base accessibility rules, retain CSS Modules for the home/header, and add route-scoped CSS Modules that safely override the legacy villa globals without rewriting functional JSX. Behavioral changes are limited to semantic landmarks, an accessible catalogue search form and a mobile booking jump link.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3, CSS Modules, existing Vinext build, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-villaone-caspian-glass-redesign-design.md`

## Global Constraints

- Preserve all existing REST endpoints, JWT behavior, Shamsi date logic, booking rules and route URLs.
- Do not add UI, animation or font dependencies.
- Use real backend content only; never add fallback listings, ratings or success states.
- Use glass only for navigation, search, image overlays and compact floating surfaces.
- Long copy, forms, financial details and operational information use opaque surfaces.
- Support `320px`, `390px`, `768px`, `1024px` and `1440px` without horizontal overflow.
- Honor `prefers-reduced-motion`; hover motion is gated behind fine-pointer media queries.
- Motion uses transform and opacity with exact transition properties, not `transition: all`.
- Backend code is out of scope. Any discovered API gap becomes a separate proposal.
- Work on `feature/quiet-luxury-home`, never `main`.

---

### Task 1: Design tokens, accessibility base and semantic landmarks

**Files:**
- Create: `app/styles/tokens.css`
- Create: `app/styles/base.css`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/villas/page.tsx`
- Modify: `app/villas/[slug]/page.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces semantic CSS variables such as `--vo-pine-950`, `--vo-surface`, `--vo-focus`, `--vo-ease-out`, `--vo-radius-control` and the shared `.skip-link` behavior.
- Produces `#main-content` on the home and villa routes so the root skip link has a stable target.

- [ ] **Step 1: Write the failing landmark test**

Add a behavior-level render assertion:

```js
test("public pages expose a working skip link and main landmark", async () => {
  for (const pathname of ["/", "/villas"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /href="#main-content"/);
    assert.match(html, /<main[^>]+id="main-content"/);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test --test-name-pattern "working skip link" tests\rendered-html.test.mjs
```

Expected: FAIL because the root layout has no skip link and the page landmarks have no stable ID.

- [ ] **Step 3: Add the token and base layers**

Define the approved semantic palette and material rules:

```css
:root {
  --vo-pine-950: #0b2924;
  --vo-caspian-700: #2f675c;
  --vo-sage-500: #8aa79d;
  --vo-mist-100: #e7eeea;
  --vo-ivory-50: #f5f1e7;
  --vo-champagne-500: #c7a56b;
  --vo-ink-900: #1a2623;
  --vo-surface: #f8f6ef;
  --vo-focus: #d9b676;
  --vo-ease-out: cubic-bezier(.23, 1, .32, 1);
  --vo-ease-in-out: cubic-bezier(.77, 0, .175, 1);
  --vo-radius-control: .75rem;
  --vo-radius-card: 1.25rem;
  --vo-radius-sheet: 1.75rem;
  --vo-shadow-float: 0 1.5rem 4rem rgb(5 36 29 / .16);
}
```

Import `tokens.css` and `base.css` after `globals.css`. Add the root skip link before page content and apply `id="main-content"` plus `tabIndex={-1}` to the scoped pages.

- [ ] **Step 4: Rebuild and verify GREEN**

Run the production build, then the focused test. Expected: both pass and the skip link target exists on both routes.

- [ ] **Step 5: Commit the foundation slice**

```powershell
git add app/styles app/layout.tsx app/page.tsx app/villas/page.tsx app/villas/[slug]/page.tsx tests/rendered-html.test.mjs
git commit -m "feat: add Caspian Glass design foundation"
```

### Task 2: Shared glass navigation

**Files:**
- Modify: `app/components/PublicHeader.tsx`
- Modify: `app/components/PublicHeader.module.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes the global `--vo-*` tokens.
- Preserves `PublicHeader({ variant?: "surface" | "overlay" })`, current route detection, authenticated identity, session-expiry handling and mobile focus management.

- [ ] **Step 1: Add the shared-navigation behavior assertion**

Extend the existing navigation test to render `/villas` and assert one named primary navigation plus the account/login destination and active-route output.

```js
assert.equal((html.match(/aria-label="منوی اصلی"/g) ?? []).length, 1);
assert.match(html, /ورود \/ ثبت‌نام|حساب کاربری/);
assert.match(html, /aria-current="page"/);
```

- [ ] **Step 2: Run the focused navigation test**

Expected: the existing contract passes before visual changes. This is a characterization gate; any later failure is a regression.

- [ ] **Step 3: Implement the glass navigation material**

Keep the component interface and behavior. Update the module so:

- Desktop height is at most `4.75rem`.
- Overlay starts visually integrated with the hero and becomes an ivory-tinted glass surface after scrolling.
- Surface variant uses the same glass recipe and opaque fallback.
- Active route uses a restrained champagne underline, not a pill.
- Pressables scale to `0.97` for `120ms` and hover only runs on fine pointers.
- Mobile drawer uses an opaque ivory content sheet with a glass top edge, full safe-area padding, focus-visible rings and no clipped account action.
- Reduced motion removes transform transitions.

- [ ] **Step 4: Build and run the navigation test**

Expected: build passes, existing session/auth tests pass and navigation remains one implementation.

- [ ] **Step 5: Commit the navigation slice**

```powershell
git add app/components/PublicHeader.tsx app/components/PublicHeader.module.css tests/rendered-html.test.mjs
git commit -m "feat: refine shared public navigation"
```

### Task 3: Cinematic homepage hero and reliable search dock

**Files:**
- Modify: `app/components/home/HomeHero.tsx`
- Modify: `app/HomePage.module.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Preserves every `HomeHeroProps` field and the existing Shamsi calendar callbacks.
- Keeps poster-first video behavior and existing routes.

- [ ] **Step 1: Write the failing homepage composition test**

```js
test("homepage hero avoids decorative scroll instructions and keeps its booking search", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /aria-label="جست‌وجوی اقامتگاه"/);
  assert.match(html, /کشف ویلاها/);
  assert.doesNotMatch(html, /برای کشف بیشتر/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the current hero renders a decorative scroll instruction.

- [ ] **Step 3: Refine hero markup**

Remove the decorative scroll cue while retaining the location note. Keep a maximum four-part hero stack: one concise kicker, two-line headline, short description and CTA group. Keep the real search form directly associated with the hero.

- [ ] **Step 4: Rebuild the hero styles**

Use a stable `min-height` based on `100dvh`, poster-first media, a controlled pine scrim and an ivory-tinted glass search dock. Ensure:

- Desktop headline remains within two lines and CTA is visible without scrolling.
- Search dock does not clip Shamsi popovers.
- At `<=820px`, search becomes a two-column surface below the hero copy.
- At `<=560px`, fields become a single clean mobile grid and the calendar is a fixed bottom sheet.
- Entry animation uses only opacity/transform and is disabled for reduced motion.

- [ ] **Step 5: Build, run the focused test and commit**

```powershell
git add app/components/home/HomeHero.tsx app/HomePage.module.css tests/rendered-html.test.mjs
git commit -m "feat: redesign homepage hero and search"
```

### Task 4: Homepage villa collection and editorial rhythm

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/components/home/HomeVillaShowcase.tsx`
- Modify: `app/components/home/HomeEditorial.tsx`
- Modify: `app/components/home/HomeFooter.tsx`
- Modify: `app/HomePage.module.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Homepage continues loading villas, cities, journal and business settings independently.
- Favorite behavior remains authenticated and API-backed.
- Homepage publishes at most four real villas in a two-column desktop grid.

- [ ] **Step 1: Add a failing rendered-home assertion for truthful editorial structure**

Assert that the server output exposes the villa collection, concierge service route, journal route, legal footer routes and no decorative vertical-label copy.

```js
assert.match(html, /id="featured-villas-title"/);
assert.match(html, /href="\/services"/);
assert.match(html, /href="\/journal"/);
assert.match(html, /href="\/privacy"/);
assert.doesNotMatch(html, />داستان ویلاوان<\/p>/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the current story section includes the decorative vertical label.

- [ ] **Step 3: Refine content selection and markup**

Select up to four backend villas instead of three. Remove decorative numbering and vertical copy. Preserve truthful loading, empty, retry and missing-image states. Keep the editorial sections functionally linked to support, services and journal.

- [ ] **Step 4: Implement the editorial layout**

Create four distinct layout families: manifesto story, two-column villa collection, media-and-copy concierge feature, standards list and journal feature. Use large real photography, restrained glass overlays, warm opaque reading surfaces and mobile single-column fallbacks.

- [ ] **Step 5: Build, run the focused test and commit**

```powershell
git add app/page.tsx app/components/home app/HomePage.module.css tests/rendered-html.test.mjs
git commit -m "feat: refine homepage villa and editorial sections"
```

### Task 5: Villa catalogue discovery experience

**Files:**
- Create: `app/villas/Villas.module.css`
- Modify: `app/villas/page.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes existing `fetchVillas`, `fetchCities`, favorites and Shamsi field APIs.
- Keeps all URL query names and filter behavior unchanged.
- Adds only a scoped root class and semantic search form.

- [ ] **Step 1: Write the failing catalogue-form test**

```js
test("villa catalogue exposes its date search as an accessible form", async () => {
  const response = await render("/villas");
  const html = await response.text();
  assert.match(html, /<form[^>]+aria-label="جست‌وجوی ویلا"/);
  assert.match(html, /type="submit"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the current search surface is a section with a non-submit button.

- [ ] **Step 3: Make search semantics production-safe**

Change `runSearch` to accept an optional form event, prevent default, render the search surface as a form and use a submit button. Preserve all existing validation and URL replacement behavior.

- [ ] **Step 4: Add route-scoped catalogue styling**

Apply the module root to the existing main element. Inside the module, use `:global(...)` only for existing catalogue classes. Recompose the page with:

- A quiet ivory hero and restrained visual brand mark.
- A sticky glass search/filter surface on wide screens.
- Two-column listing cards with stable media ratios and readable overlays.
- Full-width filter sheet behavior on mobile.
- Shape-matched skeletons and consistent error/empty states.
- No decorative fake data or unsupported claims.

- [ ] **Step 5: Build, run the catalogue test and commit**

```powershell
git add app/villas/page.tsx app/villas/Villas.module.css tests/rendered-html.test.mjs
git commit -m "feat: redesign villa catalogue discovery"
```

### Task 6: Villa detail and mobile booking access

**Files:**
- Create: `app/villas/[slug]/VillaDetail.module.css`
- Modify: `app/villas/[slug]/page.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Preserves current villa, availability, quote, review, favorite, OTP and checkout behavior.
- Adds `#booking-panel` to the existing booking aside and a mobile-only anchor that targets it.

- [ ] **Step 1: Write the failing booking-access test**

```js
test("villa detail exposes a direct mobile path to the booking panel", async () => {
  const response = await render("/villas/sample-villa");
  const html = await response.text();
  assert.match(html, /href="#booking-panel"/);
  assert.match(html, /id="booking-panel"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the current detail page has no stable booking target or mobile jump action.

- [ ] **Step 3: Add booking landmarks without changing flow logic**

Add the stable ID and a mobile action link after the heading. Preserve the existing disabled states, quote calculations, OTP path and checkout URL.

- [ ] **Step 4: Add route-scoped detail styling**

Use the module root to redesign existing global classes with:

- A controlled cinematic gallery that reserves aspect ratio.
- Clear title, trust, facts, description, amenities and availability hierarchy.
- Opaque ivory content surfaces and a sticky glass booking card on desktop.
- A mobile booking jump action and full-width booking surface below content.
- Legible status, error, lightbox, policy and review states.
- Focus-visible controls and reduced-motion fallbacks.

- [ ] **Step 5: Build, run the detail test and commit**

```powershell
git add app/villas/[slug]/page.tsx app/villas/[slug]/VillaDetail.module.css tests/rendered-html.test.mjs
git commit -m "feat: redesign villa detail experience"
```

### Task 7: Public-core release verification

**Files:**
- Modify only files required by verified defects found during this task.

**Interfaces:**
- Produces a browser-verified public milestone without backend changes.

- [ ] **Step 1: Run lint**

```powershell
node_modules\.bin\eslint.CMD . --ignore-pattern dist --ignore-pattern .next
```

Expected: exit `0`.

- [ ] **Step 2: Run the production build**

```powershell
node_modules\.bin\vinext.CMD build
```

Expected: exit `0`; no new route or compile errors.

- [ ] **Step 3: Run all rendered HTML tests**

```powershell
C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test tests\rendered-html.test.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Browser acceptance**

Start the local frontend against the configured API. Inspect `/`, `/villas` and one real `/villas/{slug}` route at `320px`, `390px`, `768px`, `1024px` and `1440px`. Verify no horizontal overflow, clipped calendar, header overlap, inaccessible control, console error or false success state. Test keyboard focus, Escape behavior and reduced motion.

- [ ] **Step 5: Run the design pre-flight review**

Review the milestone with the required Before/After/Why table. Check one locked accent, consistent radii, CTA contrast, real imagery, restrained glass, no decorative scroll cue, no repeated generic card grids, no em-dash characters in newly edited visible copy and no `transition: all` in changed styles.

- [ ] **Step 6: Commit verified corrections**

```powershell
git add app tests
git commit -m "fix: polish Caspian Glass public core"
```
