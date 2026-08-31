# Caspian Glass Customer Journey — Implementation Plan

**Goal:** Extend the approved Caspian Glass system through the authenticated booking journey without changing backend contracts or business rules.

## Constraints

- Frontend-only. Existing REST routes, JWT behavior, booking rules, payment rules, and real-data states remain unchanged.
- Glass is reserved for navigation, compact status layers, and focused controls. Forms, receipts, financial summaries, and long copy remain opaque and highly readable.
- Preserve Persian/RTL behavior, Shamsi dates, mobile access at 320px, keyboard focus, reduced motion, and truthful API error states.

## Work slices

1. **Login and access states**
   - Replace the generic split card with a calm editorial access surface.
   - Keep OTP, debug-only local code, return URL, busy, validation, and failure behavior intact.

2. **Checkout and booking summary**
   - Reframe the page as a clear two-column decision flow with a sticky opaque order summary.
   - Strengthen hierarchy for guest details, payment plan, eligible services, terms, quote loading, and booking conflicts.
   - Remove visual language that suggests payment occurs before the card-transfer step.

3. **Card-transfer payment**
   - Present bank instructions, amount, deadline, proof upload, and reference number as one focused task.
   - Add a local image preview and precise selected-file feedback without changing upload data or APIs.
   - Keep ZarinPal and phone coordination visibly disabled as «به‌زودی».

4. **Confirmation and receipt**
   - Make booking/payment status the primary message and keep actions unambiguous.
   - Style the receipt as a printable, trustworthy financial document with readable payment and service histories.

5. **Account and support**
   - Improve the customer workspace navigation, booking selection, cancellation form, favorites, profile editing, and empty/error states.
   - Rebuild support as a readable request composer and response timeline.

6. **Verification**
   - Add rendered-page structure checks for the scoped customer surfaces.
   - Test key routes in a live browser at 320px, 390px, and desktop.
   - Run ESLint, production build, rendered HTML tests, and diff checks.

## Acceptance criteria

- No customer route introduces horizontal overflow at 320px.
- Login, booking creation, payment proof submission, confirmation, receipt, profile, favorites, cancellation, and support behavior remains connected to the existing APIs.
- Payment and financial information remains opaque, legible, and free of misleading success states.
- Loading, empty, retry, conflict, and unauthenticated states are visibly distinct.
- Shared navigation behaves identically across customer routes.
