# VillaOne customer and operations website

Persian RTL frontend for the VillaOne concierge product. It reads villas, availability, bookings, business content, marketplace catalogues, and staff operations from the Django API; it does not substitute demo records when the API is empty or unavailable.

## Local setup

1. Copy `.env.example` to `.env.local` if the Django API is not using the default local address.
2. Start Django first, then run `npm install` and `npm run dev` here.
3. Open the URL printed by the development server.

## Release checks

Run `npm run lint`, `npm run build`, and `npm test`. The customer journey should then be checked manually from Shamsi search through booking receipt, followed by manual payment and approval in `/admin`.

`NEXT_PUBLIC_VILLAONE_API_URL` must point to the API root ending in `/api/v1`. Public pages deliberately show honest empty, unavailable, and retry states if real content has not been published.

For server-rendered journal pages, set `VILLAONE_INTERNAL_API_URL` to the same API root. Set `NEXT_PUBLIC_VILLAONE_SITE_URL` to the public site origin so article canonicals, Open Graph URLs, robots, and the sitemap use the real hostname.
