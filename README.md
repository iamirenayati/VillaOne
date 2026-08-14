# VillaOne V1.1

One-time monorepo snapshot of the VillaOne concierge platform for test deployment.

## Structure

- `frontend/` — Vinext/React customer website and operations workspace.
- `backend/` — Django REST API, booking operations, content management, and admin.

The snapshot corresponds to:

- Frontend commit `20c45746f978675f14512b2fd9ab78b86b7acd41`.
- Backend commit `addcdf280685a7f9575355a4256bbf058bc6258b`.

## Local development

Follow the setup instructions in [`frontend/README.md`](frontend/README.md) and
[`backend/README.md`](backend/README.md). Configure the frontend API URL with:

```env
NEXT_PUBLIC_VILLAONE_API_URL=http://127.0.0.1:8000
```

Local databases, environment files, uploaded media, payment proofs, dependencies,
and build output are deliberately excluded from this repository.

## Netlify test

Select this repository and set the Netlify base directory to `frontend`. The
frontend still requires a publicly reachable Django API; a browser deployment
cannot access a backend running at `localhost` on a developer computer.

