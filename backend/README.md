# VillaOne Django API

Production-oriented backend foundation for the VillaOne Concierge MVP.

## Included

- Iranian mobile OTP authentication and JWT access/refresh tokens
- Shared user roles for guests, owners, vendors, and administrators
- Cities, villas, amenities, media, approximate-map metadata, prices, and availability
- Date-range villa search and public detail/calendar APIs
- Transaction-safe booking creation with overlap and blocked-date protection
- Deposit/full-payment calculations and payment records
- Staff booking approval/rejection, calendar locking, and immutable audit records
- Customized Django Admin for the phase-0 internal operations team
- Real-estate listings, contractor profiles, journal publishing, and manual inquiry follow-up

## Local setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

If `DATABASE_URL` is omitted, local development uses SQLite. Production must provide PostgreSQL through `DATABASE_URL`.

### Local release-candidate runbook

Start the API from this directory with `python manage.py runserver 127.0.0.1:8000` and verify `http://127.0.0.1:8000/health/` returns `{"status":"ok","database":"reachable"}`. In a second terminal, start the customer app from `website/` with `npm run dev` (it connects to the local API automatically). Create real public content through Django Admin before opening the site to guests. Uploaded images are stored under `backend/media/` locally and must be included in backups.

### Optional local fixtures

Fixture commands are never run automatically and create drafts by default, so they cannot leak into a public catalogue:

```powershell
python manage.py seed_demo
python manage.py seed_marketplace
```

Use `--publish` only for an intentional local visual preview. Before a real release, run `python manage.py verify_release`; it checks the business contact/legal content and requires at least one published villa, contractor, property, service, and article.

For a SQLite backup, stop the API and copy both `db.sqlite3` and the `media/` directory to a dated backup location. Restore both, then run `python manage.py migrate` and `python manage.py verify_release`. For PostgreSQL, use `pg_dump --format=custom "$env:DATABASE_URL" > villaone.dump` and restore with `pg_restore --clean --if-exists --dbname "$env:DATABASE_URL" villaone.dump`; media files still require a separate copy. The scheduled `process_operational_tasks` and `check_operational_integrity` commands are the source of truth for expiry and integrity checks.

### Monthly journal workflow

The main Django superuser is the only person who manages articles. In `/admin/marketplace/article/`:

1. Save the article as a draft with its title, excerpt, category, Markdown body, and cover alt text.
2. Save once, then add inline images in the **Inline images** section. Give each image a stable lowercase key such as `forest-view`, then reference it in Markdown as `{{image:forest-view}}`.
3. Use the live preview to check headings, lists, links, captions, and image placement. Raw HTML and unsafe links are removed by the same server renderer used by the public API.
4. Add an optional internal CTA such as `/villas` or `/services/private-chef`, then publish. Publication is immediate; there is no scheduler in V1.
5. Archive an article instead of deleting it. Its slug remains reserved so published links cannot be accidentally reused.

The public journal only returns currently published articles. The local `seed_marketplace` article is a draft fixture and should be replaced with genuine launch content before release.

### Clean release rehearsal

1. Start from a new empty database and run `python manage.py migrate`.
2. Run `python manage.py createsuperuser` and assign the appropriate VillaOne role in Django Admin.
3. Complete the single **Business settings** record, including contact details and all three legal texts.
4. Add images and publish at least one genuine record in every public catalogue. Do not run fixture commands.
5. Enable card-to-card payment in **Business settings** and enter the bank, cardholder and card number.
6. Run `python manage.py verify_release`, `python manage.py test`, and the frontend `npm test`.
7. Create a booking through the public site, upload a receipt, approve it in the finance queue, and confirm its dates are unavailable publicly.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/auth/otp/request/` | Request OTP |
| POST | `/api/v1/auth/otp/verify/` | Verify OTP and receive JWTs |
| GET/PATCH | `/api/v1/auth/me/` | Current profile |
| GET | `/api/v1/villas/` | Search published villas |
| GET | `/api/v1/villas/{slug}/` | Villa detail |
| GET | `/api/v1/villas/{slug}/availability/` | Availability and nightly prices |
| POST | `/api/v1/bookings/` | Create a booking |
| GET | `/api/v1/bookings/mine/` | Guest booking history |
| GET | `/api/v1/bookings/admin/` | Staff booking queue |
| POST | `/api/v1/bookings/admin/{code}/decision/` | Staff approve/reject |
| GET | `/api/v1/marketplace/real-estate/` | Published property files |
| GET | `/api/v1/marketplace/contractors/` | Published contractor directory |
| GET | `/api/v1/marketplace/articles/` | Published journal articles |
| POST | `/api/v1/marketplace/inquiries/` | Property/contractor callback request |

In local debug mode the OTP request response includes `debug_code=123456`. Production never returns OTP codes and must connect the request service to Kavenegar or the selected SMS provider.

## Small-team operating flow

Use Django Admin as the internal control room during the concierge launch:

1. A guest creates a booking, transfers the deposit or full amount, and uploads the receipt from the payment page.
2. Finance reviews the protected receipt in the payment queue. Approval records the payment, confirms the booking, and locks calendar dates automatically. A first rejection gives the guest two hours to upload one replacement receipt.
3. After the checkout date, use **mark stay completed**. Guests can then submit a verified review.
4. For cancellation, approve or reject the guest request. The quoted refund is preserved with the request.
5. Return money manually, then use **mark refund completed**. This records the action without pretending a gateway performed it.

Do not edit booking, payment, or cancellation statuses directly. The admin actions enforce valid transitions and create audit records.

An unpaid booking request holds its dates for two hours by default, then expires and releases them automatically. Change `BOOKING_HOLD_MINUTES` only if your phone follow-up process regularly needs more or less time. A request with a recorded payment does not expire.

## Production deployment

The backend directory is deployable as its own repository. `Dockerfile` builds the API and Django Admin, while `start.sh` only starts Gunicorn without applying migrations or inserting fixtures. Run migrations explicitly through `deploy/release.sh` (or the documented Compose command) before restarting the web service. `/health/` checks both the application and its database connection.

For any later host, configure the backend independently and set the frontend API URL. Before exposing the service to guests, set the real hostname in `DJANGO_ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`, then configure the frontend with:

```text
NEXT_PUBLIC_VILLAONE_API_URL=https://your-api-host/api/v1
```

Required production values are `DJANGO_SECRET_KEY`, `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`. Keep `DJANGO_DEBUG=false`; do not set `OTP_DEBUG_CODE` in production.
