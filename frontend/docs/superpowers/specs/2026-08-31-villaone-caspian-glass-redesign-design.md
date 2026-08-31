# VillaOne Caspian Glass Redesign — Design Specification

**Date:** 2026-08-31  
**Status:** Approved design direction; implementation pending  
**Primary repository:** `website`  
**Backend boundary:** No backend or REST contract changes unless a separately reviewed implementation task proves a specific missing capability.

## 1. Purpose

Redesign VillaOne as a distinctive, production-quality Persian hospitality product for mobile and desktop. The experience must feel calm, modern and prestigious while remaining fast, legible and dependable across discovery, booking, customer service and staff operations.

The approved direction is **Caspian Glass**: a forest-and-coast visual system with warm opaque reading surfaces and selective glassmorphism. Glass is an interaction material, not a page-wide decoration.

## 2. Product principles

1. **Trust before spectacle.** Availability, prices, policies, payment state and staff actions must be easier to understand after the redesign.
2. **Selective glass.** Use translucent surfaces only for navigation, search, image overlays, compact status surfaces, drawers and dialogs. Forms, articles, receipts, tables and long copy remain opaque.
3. **Real data only.** Never introduce demo listings, fabricated metrics, ratings or false success states.
4. **Mobile is a primary operating environment.** Every critical customer and staff action must work at 320px and 390px without horizontal overflow or unreachable controls.
5. **Motion explains or confirms.** Animation must communicate state, spatial relationships or feedback. It must not delay repeated tasks.
6. **One visual system.** Public pages, customer flows and the custom operations workspace share tokens and interaction rules while retaining appropriate information density.
7. **Preserve behavior.** Existing routes, authentication, API contracts, Shamsi date logic, booking rules, payment review, protected media, maps and staff permissions remain intact.

## 3. Visual identity

### 3.1 Color system

| Token | Value | Purpose |
| --- | --- | --- |
| `--color-pine-950` | `#0B2924` | Primary dark field, hero overlays and navigation |
| `--color-caspian-700` | `#2F675C` | Primary interactive color and selected states |
| `--color-sage-500` | `#8AA79D` | Secondary accents and muted graphical detail |
| `--color-mist-100` | `#E7EEEA` | Cool supporting surface and subtle separators |
| `--color-ivory-50` | `#F5F1E7` | Main page and reading surface |
| `--color-champagne-500` | `#C7A56B` | Single luxury accent for emphasis, never body text |
| `--color-ink-900` | `#1A2623` | Primary text on light surfaces |
| `--color-danger-600` | `#A44F45` | Errors and destructive actions |
| `--color-success-700` | `#37705F` | Confirmed and successful states |

All grays are tinted toward green or warm ivory. Pure black, bright white, blue-purple gradients and multiple competing accents are excluded.

### 3.2 Glass material

The glass recipe uses:

- A pine-, ivory- or mist-tinted translucent fill.
- A one-pixel light inner edge to suggest refraction.
- A restrained inner highlight and pine-tinted outer shadow.
- `backdrop-filter` only on compact surfaces with an opaque fallback.
- Sufficient contrast in both fallback and blurred states.

Large article bodies, checkout forms, account panels, receipts and operational tables do not use translucent backgrounds.

### 3.3 Typography

- Continue using the project's locally hosted Persian-compatible font assets; do not add a runtime font dependency.
- Establish one variable sans family for interface and reading text, using weight, width and spacing rather than unrelated typefaces to create hierarchy.
- Display headings use tight line-height and balanced wrapping.
- Persian body copy uses a comfortable line-height and a maximum measure near 65 characters.
- Prices, dates, booking codes and operational values use tabular figures.
- Labels use sentence case and concise Persian wording rather than decorative all-caps conventions.

### 3.4 Spacing, shape and depth

- Use a four-pixel base spacing rhythm with semantic tokens from `4px` to `128px`.
- Page containers cap between `1200px` and `1440px` depending on information density.
- Radius varies by hierarchy: controls are tighter, cards moderate and floating glass sheets softer.
- Shadows share one upper-left light direction and use pine-tinted color.
- A nearly invisible grain layer may be used on cinematic marketing surfaces; it must not sit above form controls or text.

## 4. Motion and interaction

### 4.1 Motion rules

- Animate only `transform`, `opacity`, `clip-path` and color where practical.
- Button press feedback: `100–160ms`, with a subtle scale near `0.97`.
- Tooltips and small popovers: `125–200ms`.
- Menus and selects: `150–250ms`.
- Drawers and dialogs: `220–420ms` using an origin-aware or drawer-specific curve.
- Content entry may use short `30–70ms` staggering, but content remains immediately interactive.
- UI transitions use a strong ease-out curve; moving elements use ease-in-out. `ease-in` and `transition: all` are prohibited.
- Hover effects run only when `(hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion` removes parallax, spatial movement and decorative reveals while retaining helpful fades and color changes.

### 4.2 Interaction rules

- Every pressable surface has hover, active, focus-visible and disabled states.
- Keyboard navigation is never delayed by animation.
- Drawers and menus restore focus, support Escape and prevent background scroll.
- Success appears only after the authoritative API response.
- Errors remain next to the affected control and preserve user input when safe.
- Mobile primary actions remain reachable without precision tapping or horizontal table navigation.

## 5. Information architecture and page families

### 5.1 Shared application shell

`PublicHeader` remains the single public navigation implementation.

- Homepage variant begins transparent over the hero and becomes a solid glass surface after the hero.
- Inner-page variant starts as a solid surface.
- Smart sticky behavior returns the header on upward scroll, focus or menu interaction.
- Authenticated identity comes from the current customer session; stale identity clears on session expiry.
- Desktop navigation retains the existing destinations and active-route states.
- Mobile uses a compact top bar plus an accessible menu. A persistent bottom navigation may be introduced only for the four highest-frequency customer destinations after browser validation proves it reduces effort without duplicating controls.
- All pages include a skip-to-content link and reserve header space to prevent overlap.

### 5.2 Homepage

The homepage establishes the visual identity without becoming a heavy promotional site.

1. **Cinematic hero:** optimized poster is first paint; existing local video may load after interaction readiness. Atmospheric overlays provide depth without a continuous JavaScript animation loop.
2. **Glass search dock:** Shamsi dates, destination and guest count remain the primary task. The calendar opens outside clipping contexts and enforces current dates plus the minimum stay before navigation.
3. **Villa collection:** real published villas appear in a two-column editorial grid on wide screens and one column on mobile. Cards prioritize imagery, title, location, capacity and transparent price.
4. **Trust strip:** concise, supportable claims about verification, transparent booking and concierge assistance.
5. **Editorial modules:** backend-driven journal, services, contractors and property discovery use asymmetric compositions instead of repeated generic three-card rows.
6. **Business footer:** support contacts, legal routes and operating details come from existing business settings.

Homepage data sources continue loading independently so one failed endpoint cannot collapse unrelated sections.

### 5.3 Villa catalogue and detail

- Catalogue filters become a stable responsive toolbar on desktop and a full-width mobile sheet on small screens.
- Two-column villa cards remain the default wide-screen density; cards never exceed a comfortable reading width.
- Empty, loading, unavailable and retry states occupy the same grid geometry to prevent layout shift.
- Villa detail uses a cinematic media composition followed by a clear information hierarchy: verification, location, capacity, amenities, Shamsi availability, pricing, deposit and policies.
- Desktop booking summary may remain sticky within its column. Mobile uses an accessible bottom action bar that opens the booking panel without obscuring content.
- Approximate map location remains clearly labeled and never exposes private address information.

### 5.4 Booking, payment and customer account

- Checkout is a guided single-page review, not a decorative landing page.
- Dates, guests, services, deposit/full-payment choice and totals remain visible together before submission.
- Card-to-card instructions use an opaque financial surface; proof upload states are explicit and recoverable.
- ZarinPal and concierge/manual methods remain disabled and marked as coming soon.
- Account navigation collapses into a compact mobile switcher instead of a squeezed desktop sidebar.
- Bookings, receipts, favorites, support, cancellations and notifications share one status language and one set of state components.
- Destructive customer actions require confirmation and explain their consequences.

### 5.5 Contractors, real estate, services and journal

- Contractors remain a small curated editorial catalogue, not a dense marketplace grid.
- Real-estate listings emphasize imagery and factual property data without fake investment claims.
- Services make the upsell relationship to villa booking explicit while retaining independent inquiry flows where supported.
- Journal retains server rendering, safe Markdown, Shamsi dates, metadata and sitemap behavior. Article reading surfaces are opaque ivory with a controlled line length.
- Category navigation remains keyboard accessible and horizontally usable on mobile.

### 5.6 Map and 3D showcase

- The functional map continues to use backend villa coordinates and accessible HTML detail panels.
- Map overlays use compact glass surfaces; controls and villa information remain usable without relying on map gestures.
- The existing 3D route remains a separate fictional showcase. Its visual experimentation must not become a required step in booking or load on other routes.

### 5.7 Custom operations workspace

- The custom admin remains an API-backed operational tool; Django Admin remains the content CMS.
- Operations uses denser solid surfaces, with glass limited to the shell, drawers and compact status summaries.
- Tables become stacked records on narrow screens rather than forcing the full desktop table into the viewport.
- Role-based navigation, protected proof preview, booking decisions, payment review, calendar changes, support, cancellation, leads and audit activity preserve their current backend permissions.
- Browser alerts, prompts and false optimistic completion are prohibited.
- Every queue defines loading, empty, error, retry, saving, conflict and expired-session states.

## 6. Component architecture

The redesign extends the existing Next.js App Router structure instead of replacing it.

### 6.1 Foundation layer

- `app/styles/tokens.css`: color, typography, spacing, radius, elevation, motion and z-index tokens.
- `app/styles/base.css`: reset, semantic element defaults, body surfaces, focus-visible behavior, reduced motion and utility accessibility rules.
- `app/components/ui/`: focused reusable primitives for button, glass surface, status chip, state panel, skeleton, dialog, drawer, field and section heading.
- Primitives remain dependency-light and expose semantic variants rather than page-specific colors.

### 6.2 Page composition layer

- Existing scoped CSS modules remain the preferred styling method for page compositions.
- `globals.css` is reduced to compatibility imports and intentionally global rules. Superseded page selectors move into scoped modules phase by phase.
- Shared domain components own repeated villa, booking, article, contractor and operational presentation patterns.
- Pages remain responsible for route-level data orchestration, metadata and composition rather than low-level visual behavior.

### 6.3 Data boundary

- Existing API helpers, JWT refresh behavior, public endpoints and route contracts remain the source of truth.
- Visual components receive normalized view data and callbacks; they do not fetch hidden fallback content.
- Route-level containers own loading, retry and authorization handling.
- Any missing API field discovered during implementation is documented as a separate backend proposal before backend code changes.

## 7. State, error and recovery design

Every API-backed view supports:

| State | Required behavior |
| --- | --- |
| Initial loading | Layout-matched skeleton with reserved media dimensions |
| Empty | Truthful explanation and the safest useful next action |
| Recoverable error | Inline message, retry action and preserved context |
| Validation conflict | Field-level message plus server detail where safe |
| Expired session | Clear stale state, redirect to login and preserve intended return route |
| Saving | Disable duplicate submission while retaining context |
| Confirmed success | Render only after the server response and refresh authoritative state |

Network failure must never substitute fake content. Image failure uses a branded neutral media surface with meaningful alt handling.

## 8. Accessibility and responsive requirements

- Target WCAG 2.2 AA contrast and interaction behavior.
- Minimum touch target is `44px` where controls permit.
- All interactive controls are keyboard operable with visible focus.
- Icon-only controls have accessible names.
- Dialogs and drawers trap focus, close on Escape and restore focus.
- Form fields associate labels, help and error text programmatically.
- Live status changes use appropriate, restrained announcement regions.
- Layout acceptance widths: `320px`, `390px`, `768px`, `1024px` and `1440px`.
- No horizontal page overflow, clipped calendars, covered actions or unreadable glass at any target width.
- RTL behavior is validated for component order, directional icons, maps and mixed Persian/Latin values.

## 9. Performance requirements

- No WebGL, new motion framework or UI framework is required for the redesign.
- First paint uses poster imagery; decorative video loads lazily, remains muted and never blocks interaction.
- Reserve intrinsic image/video dimensions to prevent layout shift.
- Optimize responsive image sizes and lazy-load below-the-fold media.
- Restrict blur to compact surfaces and provide an opaque fallback for unsupported or constrained devices.
- Prefer CSS transitions and Web Animations API for predetermined motion.
- Avoid continuous pointer tracking on touch devices and disable decorative depth when reduced motion is requested.
- Maintain route-level code splitting and avoid importing the 3D experience into unrelated pages.

## 10. Security and backend boundary

This design does not authorize backend behavior changes.

- Protected receipt proofs remain available only through authenticated streaming endpoints.
- No card details, private addresses, tokens or sensitive paths enter public UI state.
- Frontend role visibility does not replace backend authorization.
- Existing sanitization and managed rendering remain mandatory for journal content.
- Existing server-side booking, payment, availability and cancellation validation remains authoritative.
- If implementation reveals a missing field or endpoint, work stops at a written additive API proposal for user approval.

## 11. Delivery decomposition

The redesign is delivered through separate implementation plans so each stage remains reviewable and independently releasable.

1. **Foundation and public shell:** tokens, base styles, primitives, shared header, focus and responsive infrastructure.
2. **Homepage and villa discovery:** hero, search, villa collection, catalogue and villa detail.
3. **Customer transaction flows:** login, checkout, payment, receipts, bookings, account, support and notifications.
4. **Marketplace and editorial:** contractors, real estate, services and journal.
5. **Map, 3D integration and operations workspace:** consistent shell, overlays, queues, drawers and mobile admin records without changing functional engines.
6. **Consolidation and release QA:** remove superseded global rules, performance checks, accessibility checks, visual regression review and production build gates.

Each plan must preserve passing behavior from previous phases and end with a production build plus targeted browser acceptance.

## 12. Testing and acceptance

### Automated gates

- Existing frontend lint, production build and rendered HTML tests pass.
- Component tests cover primitive variants, focus behavior, dialogs, drawers and recoverable states.
- Integration tests cover authentication-aware navigation, date search, favorite behavior, booking/payment states and role-specific operations.
- Backend tests remain unchanged and passing unless a separately approved API change is made.

### Browser acceptance

- Test the target widths in Chromium with clean console and successful expected API requests.
- Validate anonymous, authenticated and expired-session navigation.
- Validate keyboard-only navigation, focus restoration and Escape behavior.
- Validate reduced motion and touch/hover media-query behavior.
- Validate Shamsi calendar placement, booking summary, proof upload/review, account navigation and operational queues.
- Check loading, empty, error, retry and slow-network behavior without layout shift.

### Visual acceptance

- Glass remains legible over worst-case imagery and with backdrop blur unavailable.
- Primary actions are immediately identifiable without multiple competing accent colors.
- Villa imagery feels prominent but the two-column catalogue remains scannable.
- Long Persian copy wraps naturally with no orphaned headings or clipped controls.
- The public experience feels editorial and calm; the operations workspace feels precise and efficient.

## 13. Out of scope

- New backend models or REST contracts without separate approval.
- New payment or SMS provider integration.
- Framework migration, Tailwind migration or a new general-purpose component library.
- WebGL or Three.js outside the existing isolated showcase route.
- Demo content, generated ratings, fabricated testimonials or fake operational metrics.
- A second public navigation implementation.
- Redesigning Django Admin as part of the custom frontend refresh.

## 14. Definition of done

The redesign is complete when all planned page families use the Caspian Glass system, existing business flows remain functional, every API-backed view has truthful recovery states, all target widths pass browser acceptance, critical keyboard and reduced-motion behavior works, and the frontend lint, build and smoke gates pass without introducing backend contract changes.
