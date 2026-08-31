# VillaOne UI Completion Checklist

## Phase 1 — Foundation

- [ ] Task 1: Add Playwright UI regression harness.
- [ ] Task 2: Complete semantic tokens and Persian type scale.
- [ ] Task 3: Build shared actions and form controls.
- [ ] Task 4: Build shared layout, async-state, status, skeleton, and media primitives.
- [ ] Checkpoint A: lint, build, rendered tests, and UI smoke tests pass.

## Phase 2 — Revenue path

- [ ] Task 5: Unify PublicHeader, PublicFooter, and PublicShell.
- [ ] Task 6: Migrate villa catalogue.
- [ ] Task 7: Migrate villa detail and booking card.
- [ ] Task 8a: Migrate checkout.
- [ ] Task 8b: Migrate payment and booking confirmation.
- [ ] Checkpoint B: complete customer booking flow passes on mobile and desktop.

## Phase 3 — Remaining public UI

- [ ] Task 9a: Migrate account, receipts, and notifications.
- [ ] Task 9b: Migrate support and legal pages.
- [ ] Task 10a: Migrate services.
- [ ] Task 10b: Migrate contractors.
- [ ] Task 10c: Migrate real estate.
- [ ] Task 11: Migrate journal and article reader.
- [ ] Task 12: Finish map UI and isolate map/3D bundles.
- [ ] Checkpoint C: all public routes use shared UI contracts.

## Phase 4 — Operations UI

- [ ] Task 13a: Add admin shell and primitives.
- [ ] Task 13b: Split the admin route monolith by feature.
- [ ] Task 14a: Migrate overview, bookings, and finance.
- [ ] Task 14b: Migrate villas, calendar, and services.
- [ ] Task 14c: Migrate contractors, leads, and support.
- [ ] Task 14d: Migrate cancellations and audit.
- [ ] Checkpoint D: admin role and operational smoke tests pass.

## Phase 5 — Release polish

- [ ] Task 15: Remove superseded global CSS and finish responsive media.
- [ ] Task 16: Add route boundaries, accessibility checks, and performance budgets.
- [ ] Verify 320, 390, 768, 1024, and 1440 px layouts.
- [ ] Verify keyboard navigation, focus, dialogs, menus, and form errors.
- [ ] Verify zero console errors and no unexplained lint warnings.
- [ ] Verify ordinary routes exclude MapLibre and Three.js initial chunks.
- [ ] Run `git diff --check`.
- [ ] Run frontend lint.
- [ ] Run production build.
- [ ] Run rendered-HTML tests.
- [ ] Run Playwright and accessibility suites.
- [ ] Sync the verified frontend into the combined repository.
- [ ] Commit and push the final UI-complete milestone.
