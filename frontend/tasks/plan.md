# VillaOne UI Completion Plan — Shared System, Production Polish

## Implementation brief for Luna

Complete the remaining VillaOne frontend UI as one coherent product system. Work sequentially, keep every checkpoint deployable, and make one focused commit per task or checkpoint. This is a frontend-only milestone: do not modify Django models, serializers, routes, permissions, or business rules. If an existing API cannot support a required truthful UI state, stop and document the exact missing contract before touching backend code.

Preserve the current forest, ivory, champagne, and glass visual language. Do not introduce fake data, generic dashboard styling, excessive gradients, decorative metrics, or a new visual direction. Public pages and the operations admin may have different density, but they must share semantic color, type, spacing, focus, status, and feedback tokens.

Current verified baseline:

- Frontend branch: `feature/quiet-luxury-home`
- Frontend commit: `d25ed04`
- Combined release commit: `03b418d`
- Production build passes.
- ESLint has zero errors and 20 existing raw-image warnings.
- All 23 rendered-HTML tests pass.
- All customer-facing dropdowns already use `PublicSelect`.

## Audit findings

- `app/styles/tokens.css` exists, but typography, control, feedback, breakpoint, and surface contracts are incomplete.
- `app/globals.css` is 2,471 lines and still contains feature-specific, obsolete, and duplicated rules. This is the main cascade-risk area.
- CSS Modules often style global class names through `:global(...)`, so page markup and styles remain loosely coupled and brittle.
- The header is shared, but the footer, page shell, hero, actions, fields, status badges, loading states, empty states, and error states are not.
- Only the journal has dedicated route-level loading/error/not-found boundaries.
- Public text is frequently rendered below a comfortable reading size; legacy rules still contain 7–10 px labels.
- The admin workspace is one dense file with feature components and UI primitives mixed together.
- Raw `<img>` elements produce 20 lint warnings and several dynamic images do not reserve stable geometry.
- Map and 3D dependencies contribute to large chunks and should remain route-isolated.

## Architecture decisions

1. Global CSS contains only reset, fonts, tokens, accessibility defaults, and truly cross-application utilities. New feature styles must live in colocated CSS Modules.
2. Shared primitives live under `app/components/ui/`. They expose semantic variants, not arbitrary styling switches.
3. Public and admin surfaces share foundation tokens but use separate composition components: `PublicShell` and `AdminShell`.
4. `PublicSelect` remains the single public listbox implementation. Admin may use an `AdminSelect` adapter where compact native behavior is preferable.
5. Async pages use the same `LoadingState`, `EmptyState`, `ErrorState`, and `InlineNotice` components. Error states never imply success and always provide a valid recovery action when retry is possible.
6. Public body text is at least 0.9375rem, controls at least 0.875rem, and metadata at least 0.75rem. Admin body/control text is at least 0.8125rem. Exceptions require a documented reason.
7. Images use a shared responsive media wrapper with explicit aspect ratio, meaningful alt text, truthful fallback, lazy loading below the fold, and eager loading only for the actual LCP image.
8. The existing `/3d` showcase stays isolated and optional. It must not block or inflate ordinary public routes.
9. No backend or REST contract changes are permitted in this plan.

## Phase 1 — Establish the UI foundation

### Task 1: Add a UI regression harness

**Description:** Create a small Playwright-based browser suite for the routes that matter commercially before broad refactoring begins. Capture behavior, overflow, console, and accessible-name regressions rather than brittle pixel-perfect screenshots.

**Acceptance criteria:**

- Tests cover `/`, `/villas`, one villa detail, `/checkout`, `/payment`, `/services`, `/contractors`, `/real-estate`, `/journal`, `/account`, and `/admin` where fixtures/auth allow.
- Viewports include 390×844, 768×1024, and 1440×900.
- Every tested route fails on horizontal overflow, uncaught console errors, missing `main`, or unnamed primary actions.

**Verification:** `npm run lint`, `npm run build`, `npm run test:ui`.

**Dependencies:** None.

**Files likely touched:** `package.json`, `playwright.config.ts`, `tests/ui/public-smoke.spec.ts`, `tests/ui/admin-smoke.spec.ts`.

**Estimated scope:** Medium.

### Task 2: Complete semantic tokens and type scale

**Description:** Extend the existing tokens without changing the approved palette. Define semantic background, text, border, status, type, control-height, content-width, and motion contracts. Move duplicate font declarations out of `globals.css`.

**Acceptance criteria:**

- All shared primitives can be styled without raw hex values or one-off font sizes.
- Persian body, label, metadata, title, and display scales are explicit and responsive.
- Reduced-motion and high-contrast behavior are represented at the foundation level.

**Verification:** Token usage lint/search shows no newly introduced raw palette values in shared primitives; build passes.

**Dependencies:** Task 1.

**Files likely touched:** `app/styles/tokens.css`, `app/styles/base.css`, `app/globals.css`.

**Estimated scope:** Small.

### Task 3: Build shared actions and form controls

**Description:** Add composable Button, IconButton, TextField, TextArea, Field, Checkbox, and InlineNotice primitives. Keep `PublicSelect`, but align it with the same field contract and token scale.

**Acceptance criteria:**

- All controls expose labels, descriptions, errors, disabled/loading states, and visible focus.
- Buttons have only semantic variants: primary, secondary, quiet, danger, and text.
- Touch targets are at least 44×44 CSS pixels on public mobile surfaces.

**Verification:** Keyboard tests for every primitive; rendered states documented in a local `/ui-preview` development-only page or component test.

**Dependencies:** Task 2.

**Files likely touched:** `app/components/ui/Button.tsx`, `app/components/ui/FormControls.tsx`, `app/components/ui/Feedback.tsx`, `app/components/PublicSelect.tsx`, corresponding CSS Modules.

**Estimated scope:** Medium.

### Task 4: Build shared layout, state, and media primitives

**Description:** Create Container, Section, PageIntro, Surface, StatusBadge, LoadingState, EmptyState, ErrorState, Skeleton, and ResponsiveMedia components. These replace repeated class-name recipes and raw-image markup.

**Acceptance criteria:**

- Loading, empty, error, retry, and unavailable states have one visual and accessibility contract.
- Media reserves layout space before loading and supports backend URLs plus branded missing-image fallbacks.
- Components remain usable at 320 px without overflow.

**Verification:** Component tests cover state semantics and image fallback; lint raw-image warning count begins decreasing.

**Dependencies:** Tasks 2–3.

**Files likely touched:** `app/components/ui/Layout.tsx`, `app/components/ui/AsyncState.tsx`, `app/components/ui/ResponsiveMedia.tsx`, corresponding CSS Modules.

**Estimated scope:** Medium.

## Checkpoint A — Foundation

- `npm run lint`, `npm run build`, existing rendered-HTML tests, and new UI smoke tests pass.
- No route has been visually redesigned yet; primitives are proven before migration.
- Commit: `refactor(ui): establish VillaOne design-system primitives`.

## Phase 2 — Unify the public shell and revenue path

### Task 5: Unify header, footer, and page shell

**Description:** Keep `PublicHeader` as the only navigation implementation. Promote the home footer into a backend-aware `PublicFooter`, then introduce a `PublicShell` composition used by all normal public pages. Immersive `/3d` may opt out of the footer.

**Acceptance criteria:**

- Header, authenticated identity, active route, mobile menu, safe areas, and footer are consistent everywhere.
- Footer legal/support/business details use existing backend configuration and show truthful unavailable states.
- Legacy global `.public-header__*`, `.mini-footer`, and duplicate footer rules are removed after migration.

**Verification:** Navigate every public route at desktop and mobile; header/footer do not jump, overlap, clip, or change styling unexpectedly.

**Dependencies:** Checkpoint A.

**Files likely touched:** `app/components/PublicHeader.tsx`, `app/components/PublicHeader.module.css`, `app/components/PublicFooter.tsx`, `app/components/PublicShell.tsx`, `app/globals.css`.

**Estimated scope:** Medium.

### Task 6: Migrate villa discovery

**Description:** Rebuild `/villas` on shared layout, form, state, media, and action primitives while preserving its API, URL filters, Shamsi calendar, two-column desktop grid, and truthful content.

**Acceptance criteria:**

- Search/filter controls share the same geometry and error treatment as the homepage.
- Cards reserve image space, use readable typography, and preserve two columns at suitable desktop widths and one column on mobile.
- Loading, empty, API error, retry, and invalid-date states use shared components.

**Verification:** Search, filter, sort, favorite, empty, and retry flows pass at 390 px and 1440 px.

**Dependencies:** Task 5.

**Files likely touched:** `app/villas/page.tsx`, `app/villas/Villas.module.css`, shared UI imports, focused tests.

**Estimated scope:** Medium.

### Task 7: Migrate villa detail and booking card

**Description:** Consolidate villa detail gallery, facts, trust, availability, policies, and sticky booking card into scoped modules and shared controls. Preserve all booking rules and API calls unchanged.

**Acceptance criteria:**

- No 7–10 px customer-facing text remains.
- Gallery and lightbox have keyboard close/navigation, stable image geometry, and mobile scroll snapping.
- Booking card remains visible and usable without covering content; all validation is announced and readable.

**Verification:** Available, blocked, occupied, invalid-capacity, anonymous-login, and API-error paths work on mobile and desktop.

**Dependencies:** Task 6.

**Files likely touched:** `app/villas/[slug]/page.tsx`, `app/villas/[slug]/VillaDetail.module.css`, `app/components/AvailabilityCalendar.tsx`, shared UI imports.

**Estimated scope:** Medium.

### Task 8A: Migrate checkout

**Description:** Move checkout fields, service selection, totals, legal acknowledgement, validation, and submit states onto the shared system. Preserve all backend-calculated totals and booking behavior.

**Acceptance criteria:**

- Progress, price summary, service selection, errors, and submission states share consistent hierarchy.
- Sticky summaries become normal-flow panels on mobile and never hide the submit action.

**Verification:** Deposit/full selection, upsells, login requirement, booking conflict, retry, and successful hold creation pass.

**Dependencies:** Task 7.

**Files likely touched:** `app/checkout/page.tsx`, `app/checkout/Checkout.module.css`, focused tests.

**Estimated scope:** Medium.

### Task 8B: Migrate payment and confirmation

**Description:** Continue the same transactional visual language through card-transfer instructions, protected receipt upload, review state, and booking confirmation.

**Acceptance criteria:**

- Card instructions, proof upload, expiry, review, rejection, retry, and confirmation states use shared controls and feedback.
- Mobile layouts keep exact amount, expiry, upload, and next-step explanation visible without overlap.
- Upload status and failure never produce a false success state.

**Verification:** Receipt upload, invalid file, retry, rejected replacement, expired hold, and confirmed booking paths pass.

**Dependencies:** Task 8A.

**Files likely touched:** `app/payment/page.tsx`, `app/payment/Payment.module.css`, `app/booking-confirmed/page.tsx`, `app/booking-confirmed/Confirmation.module.css`.

**Estimated scope:** Medium.

## Checkpoint B — Revenue path

- The complete `search → villa → checkout → payment → confirmation` flow is visually coherent.
- No backend files or API contracts changed.
- No public control or critical message is below the approved type minimum.
- Commit: `refactor(ui): unify customer booking experience`.

## Phase 3 — Complete customer and editorial surfaces

### Task 9A: Migrate account, receipts, and notifications

**Description:** Create one account-area shell and use shared status, form, action, and async-state components across customer bookings and communication history.

**Acceptance criteria:**

- Account navigation and identity are consistent across overview, booking receipt, and notifications.
- Cancellation forms have inline validation, persistent results, and reachable mobile actions.
- Receipts retain print styling.

**Verification:** Anonymous, expired-session, empty account, booking history, cancellation, notification-read, and print-preview paths pass.

**Dependencies:** Checkpoint B.

**Files likely touched:** `app/account/page.tsx`, account subroutes, account CSS Modules.

**Estimated scope:** Medium.

### Task 9B: Migrate support and legal pages

**Description:** Use shared forms, state panels, content widths, shell, and footer for customer support and backend-managed policy pages.

**Acceptance criteria:**

- Support forms show inline validation, pending state, confirmed server success, failure, and retry consistently.
- Legal pages use comfortable Persian reading width, clear section navigation, and the shared footer.
- Missing business-managed content is presented truthfully.

**Verification:** Support error/success, legal loading/error/empty, keyboard, and mobile layouts pass.

**Dependencies:** Task 5 and Checkpoint A.

**Files likely touched:** `app/support/page.tsx`, `app/support/Support.module.css`, `app/components/LegalPage.tsx`, a scoped legal CSS Module.

**Estimated scope:** Medium.

### Task 10A: Migrate services

**Description:** Move the service catalogue and detail experience onto shared catalogue, media, action, and state primitives while preserving bookable and inquiry-only behavior.

**Acceptance criteria:**

- Catalogue spacing, media frames, card actions, price explanations, badges, and state panels use shared primitives.
- Long Persian copy, missing images, one-item catalogues, and empty catalogues remain visually intentional.

**Verification:** List/detail loading, empty, failure, retry, booking CTA, and inquiry CTA states pass at all target widths.

**Dependencies:** Task 5 and Checkpoint A.

**Files likely touched:** `app/services/page.tsx`, `app/services/[slug]/page.tsx`, a scoped services CSS Module, focused tests.

**Estimated scope:** Medium.

### Task 10B: Migrate contractors

**Description:** Preserve the intentionally small, curated contractor experience while applying the shared editorial catalogue, media, action, inquiry, and async-state contracts.

**Acceptance criteria:**

- Profiles feel editorial rather than like a generic marketplace grid.
- Estimate language, catalogue anchors, and inquiry feedback remain clear and truthful.
- Missing images, one contractor, empty, failure, and long-content cases remain intentional.

**Verification:** List/detail/inquiry validation, API failure, retry, and confirmed success pass at all target widths.

**Dependencies:** Task 5 and Checkpoint A.

**Files likely touched:** `app/contractors/page.tsx`, `app/contractors/[slug]/page.tsx`, `app/contractors/Contractor.module.css`, `app/components/InquiryForm.tsx`.

**Estimated scope:** Medium.

### Task 10C: Migrate real estate

**Description:** Apply the shared editorial catalogue and inquiry grammar to real-estate list/detail routes without adding filters, metrics, or backend fields.

**Acceptance criteria:**

- Listing facts, prices, trust wording, CTAs, media, and inquiry states use shared primitives.
- One-item, empty, missing-image, long-title, and API-error cases remain balanced.
- No guarantees, fake investment claims, or fake availability appear.

**Verification:** List/detail/inquiry loading, empty, failure, retry, and success states pass at all target widths.

**Dependencies:** Task 5 and Checkpoint A.

**Files likely touched:** `app/real-estate/page.tsx`, `app/real-estate/[slug]/page.tsx`, `app/real-estate/RealEstate.module.css`, focused tests.

**Estimated scope:** Medium.

### Task 11: Migrate journal and article reader

**Description:** Preserve the server-rendered journal and editorial SEO while moving its shell, cards, state panels, actions, and footer onto the shared system.

**Acceptance criteria:**

- Category tabs remain keyboard accessible and horizontally usable on mobile.
- One-article, many-article, empty, loading, error, and not-found layouts are composed intentionally.
- Article body stays 15–18 px with comfortable Persian line length and no sticky-header/progress collision.

**Verification:** Metadata, JSON-LD, sitemap, category URLs, sharing, TOC, related content, and archive disappearance tests remain green.

**Dependencies:** Tasks 4–5.

**Files likely touched:** `app/journal/*`, `app/journal/[slug]/*`.

**Estimated scope:** Medium.

### Task 12: Finish map and isolate immersive routes

**Description:** Move map chrome onto shared fields/actions/states without changing map behavior. Dynamically isolate MapLibre and Three.js so ordinary routes do not carry their runtime cost.

**Acceptance criteria:**

- Map filters, villa drawer/list, empty/error states, and mobile sheet use the shared visual system.
- Map labels remain Latin-only as currently required; real Persian UI remains outside the map canvas.
- `/3d` and `/map` heavy modules load only when their routes are opened and have poster/loading/error fallbacks.

**Verification:** Bundle analysis confirms no MapLibre/Three.js in homepage or villa-route initial chunks; map/3D keyboard and reduced-motion smoke tests pass.

**Dependencies:** Tasks 3–5.

**Files likely touched:** `app/map/*`, `app/3d/*`, route-level dynamic import boundaries.

**Estimated scope:** Medium.

## Checkpoint C — Public experience complete

- Every public route uses shared shell, controls, feedback, media, and typography contracts.
- Every public route has a deliberate loading/error/not-found strategy.
- No horizontal overflow at 320, 390, 768, 1024, or 1440 px.
- Commit: `refactor(ui): complete public experience system`.

## Phase 4 — Make operations UI maintainable

### Task 13A: Establish admin shell and primitives

**Description:** Add AdminShell, AdminNav, AdminPageHeader, AdminFilters, AdminTable, AdminDrawer, AdminDialog, AdminField, AdminSelect, and AdminState primitives using the shared semantic tokens with denser sizing.

**Acceptance criteria:**

- All admin dialogs/drawers share focus trapping, Escape, scroll lock, saving state, errors, and confirmations.
- No browser alert/prompt/confirm is introduced.

**Verification:** Existing admin rendered tests pass; keyboard-only navigation works through sidebar, filters, tables, drawers, and dialogs.

**Dependencies:** Checkpoint A.

**Files likely touched:** `app/admin/components/*`, `app/admin/Admin.module.css`, focused component tests.

**Estimated scope:** Medium.

### Task 13B: Split the admin route by operational domain

**Description:** Extract feature implementations from `app/admin/page.tsx` without changing their API calls or behavior.

**Acceptance criteria:**

- The route file orchestrates views but contains no full feature implementation.
- Each operational feature owns its view, local state, and focused tests.
- Shared behavior moves to admin primitives rather than being duplicated between features.

**Verification:** Existing admin rendered tests and current operations smoke paths pass unchanged.

**Dependencies:** Task 13A.

**Files likely touched:** `app/admin/page.tsx`, `app/admin/features/*`, admin tests.

**Estimated scope:** Medium.

### Task 14A: Migrate overview, bookings, and finance

**Description:** Move the highest-frequency decision queues onto admin primitives without altering requests or permissions.

**Acceptance criteria:**

- Each queue has consistent counts, filters, states, pagination, detail, and mutation feedback.
- Finance proof preview and approval/rejection confirmations remain fully functional.
- Mobile tables become readable cards or intentional scroll containers with reachable actions.

**Verification:** Role-specific navigation, expired session, receipt review, and booking decision pass at 390 px and 1440 px.

**Dependencies:** Task 13.

**Files likely touched:** overview, booking, and finance files under `app/admin/features/`, admin tests.

**Estimated scope:** Medium.

### Task 14B: Migrate villas, calendar, and services

**Description:** Move inventory, availability, bulk editing, pricing, service catalogue, fulfilment, and capacity views onto admin primitives.

**Acceptance criteria:**

- Dense calendar information remains legible and operational at desktop widths.
- Mobile users can reach search, selection, edit, and confirmation controls without clipped content.
- Booked-date protection and authoritative server refresh behavior remain unchanged.

**Verification:** Villa edit, calendar block/unblock, price override, service edit, fulfilment, and capacity flows pass.

**Dependencies:** Task 14A.

**Files likely touched:** villa, calendar, and service files under `app/admin/features/`, admin tests.

**Estimated scope:** Medium.

### Task 14C: Migrate contractors, leads, and support

**Description:** Standardize catalogue management and human follow-up queues on shared admin tables, filters, drawers, forms, and feedback.

**Acceptance criteria:**

- Contractor state actions, lead assignment/follow-up, and support response are consistent and role-aware.
- Overdue and unassigned states remain visible without relying only on color.
- Mutation errors preserve entered form data and allow retry.

**Verification:** Contractor edit, lead transition/assignment, and support response flows pass at mobile and desktop widths.

**Dependencies:** Task 14A.

**Files likely touched:** contractor, lead, and support files under `app/admin/features/`, admin tests.

**Estimated scope:** Medium.

### Task 14D: Migrate cancellations and audit

**Description:** Finish the finance-sensitive cancellation/refund queue and audit browser using the shared admin system.

**Acceptance criteria:**

- Approval, rejection, and refund recording require clear confirmations and show authoritative results.
- Audit rows expose actor, action, target, and Shamsi time with usable mobile detail.
- Finance/content/super-admin visibility remains unchanged.

**Verification:** Cancellation decision, refund record, pagination/filtering, and audit browsing pass for each staff role.

**Dependencies:** Task 14A.

**Files likely touched:** cancellation and audit files under `app/admin/features/`, admin tests.

**Estimated scope:** Medium.

## Checkpoint D — Operations UI complete

- All admin views use shared admin primitives and live APIs.
- `app/admin/page.tsx` is orchestration-only.
- Role boundaries and operational behavior remain unchanged.
- Commit: `refactor(admin-ui): complete operations design system`.

## Phase 5 — Remove legacy risk and ship

### Task 15: Delete superseded CSS and finish responsive media

**Description:** Remove only selectors proven unused after every page migration. Move remaining feature rules out of `globals.css`, eliminate duplicate header/footer/font declarations, and replace appropriate raw images through `ResponsiveMedia` or framework image handling. Protected blob previews may remain raw images with an explicit lint exception.

**Acceptance criteria:**

- `globals.css` contains reset, legacy compatibility only where still documented, and no active page feature blocks.
- Raw-image warnings are zero except documented secure blob/map exceptions.
- Image geometry prevents visible layout shift and missing media uses truthful branded fallbacks.

**Verification:** `git diff --check`, lint, build, UI suite, and an unused-selector audit pass.

**Dependencies:** Checkpoints C–D.

**Files likely touched:** `app/globals.css`, feature CSS Modules, shared media component, ESLint configuration only if exceptions are justified.

**Estimated scope:** Medium.

### Task 16: Add route boundaries and final accessibility/performance gates

**Description:** Add shared route-level loading, error, and not-found boundaries where client-only state is insufficient. Run automated accessibility checks and define practical bundle/performance budgets.

**Acceptance criteria:**

- Critical route groups have useful loading, error, retry, and not-found rendering.
- Automated accessibility scan reports no serious/critical issues on critical public and admin routes.
- No console errors; CLS is below 0.1; LCP target is below 2.5 s on the local production build under a normal mobile throttle; ordinary-route initial JS excludes map/3D engines.

**Verification:** Full lint/build/tests, Playwright suite, axe scan, bundle inspection, and manual keyboard pass.

**Dependencies:** Task 15.

**Files likely touched:** route `loading.tsx`, `error.tsx`, `not-found.tsx`, test configuration, performance-budget script.

**Estimated scope:** Medium.

## Final definition of done

- One visual system governs all public pages; one compact derivative governs admin.
- A token or primitive change propagates instead of requiring page-by-page repair.
- Public and admin critical flows work at 320, 390, 768, 1024, and 1440 px.
- Text is readable, focus is visible, dialogs manage focus, and controls meet touch-target requirements.
- Real loading, empty, error, retry, conflict, session-expiry, and success states are handled consistently.
- No fake content or backend behavior is introduced.
- Existing REST routes and booking/payment/business rules remain unchanged.
- Lint has zero errors and no unexplained warnings; production build and all automated suites pass.
- The combined repository is synchronized and pushed only after the final verification checkpoint.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Large CSS cleanup changes working pages | High | Migrate one vertical slice, verify, then remove only selectors proven unused. |
| Shared primitives become over-configurable | Medium | Keep semantic variants small; feature composition stays in page modules. |
| Admin refactor changes business behavior | High | Move code without rewriting requests; preserve focused behavior tests before extraction. |
| Image optimization breaks protected/dynamic URLs | Medium | Use one media adapter; exempt authorized blob previews explicitly. |
| Visual tests become brittle | Medium | Assert overflow, states, semantics, and a few stable screenshots rather than every pixel. |
| Map/3D inflate normal routes | High | Enforce dynamic route isolation and inspect chunks at the final gate. |

## Instructions Luna must follow

1. Start from the committed baseline and confirm a clean worktree.
2. Implement tasks in dependency order; do not attempt a whole-site rewrite in one commit.
3. Use `apply_patch` for edits and preserve real API-backed behavior.
4. Never add new feature selectors to `globals.css`.
5. Do not touch backend/API logic without explicit user approval.
6. At every checkpoint run lint, production build, rendered tests, and relevant browser tests.
7. If a checkpoint is not green, fix it before starting the next phase.
8. Commit with the messages specified above and sync to the combined `VillaOne` repository only after verified checkpoints.
