# SalonBook — Backend API

The REST API behind SalonBook: services, appointments, customers, dashboards,
Stripe payments and Better Auth identity. Built with Express 5, TypeScript and
MongoDB.

- **Live API:** _add deployment URL_
- **Backend repository:** https://github.com/Saif-nyt/salonbook-server
- **Frontend repository:** https://github.com/Saif-nyt/salonbook

---

## Stack



```
src/
  index.ts              Express app, every API route, DB connection, HTTP server, shutdown
  config/               env schema, constants, database connection
  models/               User, Service, Appointment, Transaction, WebhookEvent
  controllers/          HTTP parsing and response envelopes
  services/             business rules and persistence
  middleware/           auth, role gates, Zod validation, upload, errors
  lib/                  Better Auth config, JWT/JWKS, Stripe and ImgBB clients
  validators/           shared Zod schemas
  utils/                API envelope, AppError, dates, Mongo helpers
```

All route definitions live in `src/index.ts` next to the middleware order they depend
on. Controllers stay thin and services own the business rules. Because Express matches
in order, `/services/categories`, `/appointments/availability` and `/appointments/mine`
are declared before their `/:id` counterparts, and the Stripe webhook is registered
before `express.json()` so it receives the raw body.

Every response uses:

```json
{ "success": true, "data": { }, "message": "optional", "meta": { } }
{ "success": false, "error": { "code": "SLOT_UNAVAILABLE", "message": "…", "details": [] } }
```

## Data model

| Collection | Purpose |
| --- | --- |
| `user` | Better Auth-managed identity plus `role`, `isBlocked`, `phone` |
| `service` | Treatment menu: name, category, description, price, duration, image, status |
| `appointment` | Customer request with service snapshot, date, slot, status, payment status, `active` flag |
| `transaction` | One Stripe checkout per appointment, unique `appointmentId`, status and session reference |
| `webhook_events` | Processed Stripe event IDs for idempotency |

Design choices worth knowing:

- **Service snapshots.** Appointments copy `serviceName`, `serviceImage`,
  `serviceCategory` and `serviceDuration`. Deleting a service never destroys visit
  history or receipts.
- **One active booking per slot.** A partial unique index on
  `{ appointmentDate, timeSlot }` where `active: true` enforces this in MongoDB, not
  just in application code. Cancelling sets `active: false`, releasing the slot.
- **Prices are server-side.** Booking accepts only a service ID, date, slot and
  message. The price and duration are read from the service document and stored.
- **One transaction per appointment.** A unique index prevents duplicate checkouts
  from creating parallel payment records.

## Authentication and roles

Better Auth is mounted at `/api/auth/*` on this server. The JWT plugin issues
asymmetric tokens; the JWKS endpoint is `/api/auth/jwks`.

The API does **not** trust client claims:

1. `authenticate` extracts the bearer token, verifies the signature against the
   JWKS (default `${SERVER_URL}/api/auth/jwks`), then reloads the user from MongoDB.
2. If the user is missing or `isBlocked`, the request fails with `403`.
3. `requireAdmin` / `requireCustomer` enforce the role from the database.
4. Better Auth hooks reject blocked users at sign-in and revoke their sessions.

### Registration rules

- Public sign-up always creates `role: "customer"`.
- A Better Auth database hook forces the role on insert, so a crafted request cannot
  create an admin.
- Password complexity (6+ characters, upper and lower case) is enforced by the auth
  config, not only in the UI.
- Profile updates accept `name`, `phone` and `image` only. `role` and `isBlocked` are
  ignored by the profile endpoint.

### Creating the first admin

The only supported path is the protected setup endpoint, used once after deployment or
against a fresh local database:

```bash
curl -X POST https://api.example.com/api/admin/setup \
  -H 'Content-Type: application/json' \
  -H "X-Admin-Setup-Secret: $ADMIN_SETUP_SECRET" \
  -d '{"name":"SalonBook Admin","email":"admin@example.com","password":"StrongPass1"}'
```

It is disabled when `ADMIN_SETUP_SECRET` is not configured, rejects requests with a
wrong secret, refuses a second admin once one exists, and — when `ADMIN_EMAIL` is set —
only accepts that address.

There is no UI control and no public endpoint that can promote an account to admin.

## Appointments and availability

State machine:

```
pending ──(admin confirm)──► confirmed ──(Stripe webhook)──► paid
   │                              │
   └──(owner/admin cancel)──► cancelled
```

- Customers create `pending / unpaid` requests only for active services.
- Customers may cancel only their own **pending** appointments. Admins may cancel any
  non-cancelled appointment.
- Only an admin can confirm, and only from `pending`.
- Only a confirmed, unpaid appointment owned by the customer can start checkout.
- Cancelled appointments are rejected before any Stripe call.
- Availability returns the ten salon slots for a date with an `available` boolean,
  excluding active bookings.

## Payments

`POST /api/payments/checkout/:id` creates a Stripe Checkout Session and a local
`pending` transaction. It returns the session URL; the frontend redirects.

`POST /api/payments/webhook`:

- is mounted **before** `express.json()` so the raw body is available;
- verifies the `stripe-signature` header with `STRIPE_WEBHOOK_SECRET`;
- records the event in `webhook_events` and ignores duplicates;
- on `checkout.session.completed` and `checkout.session.async_payment_succeeded`,
  marks the transaction paid and the appointment `paid`;
- on failure/expiry events, marks the transaction failed and keeps the appointment
  unpaid.

There is no endpoint that lets a client mark a payment paid. The success page only
reads status.

## API overview

All routes are prefixed with `/api`.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/health` | public (not under `/api`) |
| GET | `/services` | public; `search`, `category`, `status`, `sort`, `page`, `limit`, `includeInactive` |
| GET | `/services/categories` | public |
| GET | `/services/:id` | public |
| POST | `/services` | admin |
| PATCH | `/services/:id` | admin |
| PATCH | `/services/:id/status` | admin |
| DELETE | `/services/:id` | admin |
| GET | `/appointments/availability?date=YYYY-MM-DD` | public |
| GET | `/appointments/mine` | customer |
| POST | `/appointments` | customer |
| GET | `/appointments` | admin |
| GET | `/appointments/:id` | owner or admin |
| PATCH | `/appointments/:id/confirm` | admin |
| PATCH | `/appointments/:id/cancel` | owner (pending) or admin |
| GET | `/dashboard/customer` | customer |
| GET | `/dashboard/admin` | admin |
| GET | `/users/me` | authenticated |
| PATCH | `/users/me` | authenticated |
| GET | `/users` | admin |
| GET | `/users/:id` | admin |
| PATCH | `/users/:id/block` | admin |
| PATCH | `/users/:id/unblock` | admin |
| GET | `/transactions/mine` | customer |
| GET | `/transactions` | admin |
| POST | `/payments/checkout/:id` | customer |
| GET | `/payments/status?session_id=…` | customer |
| POST | `/payments/webhook` | Stripe signature |
| POST | `/uploads` | authenticated (multipart `image`) |
| POST | `/admin/setup` | `X-Admin-Setup-Secret` |

Better Auth additionally exposes `/api/auth/*` (sign-up, sign-in, token, JWKS,
Google callbacks, sign-out).

## Getting started

### 1. Requirements

- Node.js 20.9+
- MongoDB (local, Docker or Atlas)

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | no | `development`, `test` or `production` |
| `PORT` | no | Default `5000`. On macOS use `5050` if Control Center owns 5000 |
| `MONGODB_URI` | yes | Full connection string including database name |
| `SERVER_URL` | yes | This API's public origin |
| `CLIENT_URL` | yes | Frontend public origin, used for CORS and redirects |
| `BETTER_AUTH_URL` | yes | Public auth base. Because auth is proxied, use the **frontend** origin |
| `BETTER_AUTH_BASE_URL` | no | Optional alias for the same value |
| `AUTH_JWKS_URL` | no | Defaults to `${SERVER_URL}/api/auth/jwks` |
| `ALLOWED_ORIGINS` | no | Extra comma-separated origins for CORS |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables Google OAuth when both are set |
| `STRIPE_SECRET_KEY` | no | Enables checkout with a webhook secret present |
| `STRIPE_WEBHOOK_SECRET` | no | Required for checkout and webhook verification |
| `STRIPE_CURRENCY` | no | Three-letter code, default `usd` |
| `IMGBB_API_KEY` | no | Enables image uploads |
| `ADMIN_EMAIL` | no | Restricts `POST /api/admin/setup` to one address |
| `ADMIN_SETUP_SECRET` | no | 16+ chars; enables `POST /api/admin/setup` |

Secrets belong in the host's environment settings. `.env` is gitignored.

### 4. Prepare the database and an admin

The API creates its collections and indexes on boot. The service menu starts empty, so
create the first admin through the setup endpoint and then add services from the admin
dashboard (or `POST /api/services` with the admin token):

```bash
curl -X POST http://localhost:5050/api/admin/setup \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Setup-Secret: <value of ADMIN_SETUP_SECRET>' \
  -d '{"name":"SalonBook Admin","email":"admin@salonbook.com","password":"AdminPass123"}'
```

### 5. Run

```bash
npm run dev     # tsx watch
# or
npm run build && npm start
```

`GET http://localhost:5000/health` should return `"database":"connected"`. The
`payments` field reports whether Stripe is configured.

### Google OAuth

1. Create an OAuth client in Google Cloud Console.
2. Authorized redirect URI: `https://<api-host>/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and restart.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` on the frontend.

### Stripe

1. Use a **test mode** secret key and create a webhook endpoint pointing at
   `https://<api-host>/api/payments/webhook`.
2. Subscribe to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired` and
   `payment_intent.payment_failed`.
3. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. For local testing forward events:
   `stripe listen --forward-to localhost:5000/api/payments/webhook`.

### ImgBB

Set `IMGBB_API_KEY` to allow `POST /api/uploads` (field name `image`, images up to
5 MB). Without it, the endpoint returns a configuration error and the UI falls back to
pasting an image URL.

---

## Testing

Automated checks in the repository:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # emit to dist/
```

There is no test runner or smoke suite checked in. The API was exercised manually
against a scratch MongoDB during development, covering:

- customer sign-up, role assignment and profile updates;
- `401` / `403` for unauthenticated and wrong-role access;
- admin-only service creation and admin booking rejection;
- server-side pricing and the default `pending / unpaid` state;
- duplicate slot → `409`, availability reporting, released cancellations;
- confirm/cancel ownership and state rules;
- checkout refused without Stripe (`503`) and for cancelled appointments (`409`);
- cross-customer appointment access (`404`) and inactive services;
- block/unblock and blocked-session denial;
- invalid webhook signature (`400`) and unknown routes (`404`).

**Not tested end-to-end:** real Stripe Checkout/webhooks and ImgBB uploads, because no
credentials were available. Signature rejection, checkout guards and error ordering
were checked. Google OAuth was also not exercised against Google.

## Deployment

Works on any Node host (Render, Railway, Fly.io, a VM) with MongoDB Atlas.

1. Create the database and set `MONGODB_URI`.
2. Set all production env vars; `BETTER_AUTH_SECRET` must be strong and unique.
3. Build with `npm run build`, start with `npm start`.
4. Set `SERVER_URL` to the API origin and `CLIENT_URL` + `BETTER_AUTH_URL` to the
   frontend origin.
5. Call `POST /api/admin/setup` once with `ADMIN_SETUP_SECRET`, then add services from
   the admin dashboard.
6. Register the Stripe webhook and Google redirect URI for the production hosts.
7. Confirm `/health` and `/api/auth/jwks` are reachable over HTTPS.

Because the frontend proxies `/api/auth/*`, `BETTER_AUTH_URL` must be the **frontend**
origin, while `SERVER_URL` remains the API origin. CORS must allow the frontend origin.

## Security notes

- No secrets are returned by any endpoint; transaction responses contain session
  references, not card data.
- Helmet is enabled, `x-powered-by` is disabled and CORS is allow-listed.
- Webhook bodies are read raw and verified before parsing into domain actions.
- Every admin route is protected server-side, independent of the UI.
- The setup endpoint requires a long secret and is inert without it.
- Input is validated with Zod at the route boundary; Mongo identifiers are validated
  before use.

## Known limitations

- Slot availability is global (one booking per date/time), not per stylist.
- No email delivery: confirmations are visible in-app only.
- No refunds or partial payments. Cancelling a paid appointment does not refund the
  Stripe charge.
- The service menu starts empty on a fresh database; create services from the admin
  dashboard.
- Real Stripe/ImgBB/Google integrations remain unverified without credentials.
