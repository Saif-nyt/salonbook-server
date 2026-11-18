# SalonBook — Backend API

REST API behind SalonBook: services, appointments, customers, dashboards, Stripe payments, and Better Auth identity. Built with Express 5, TypeScript, and MongoDB.

- **Live website:** https://salonbook-three.vercel.app/
- **Live API:** https://salonbook-server-nkgk.vercel.app/
- **Backend repository:** https://github.com/Saif-nyt/salonbook-server
- **Frontend repository:** https://github.com/Saif-nyt/salonbook

---

## Features

- **Better Auth identity** — email/password, Google sign-in, JWT access tokens verified via JWKS
- **Role-based authorization** — `authenticate`, `requireAdmin`, `requireCustomer`, blocked-account enforcement
- **Service catalogue** — search, category filter, price/name sorting, pagination, active/inactive status
- **Appointment booking** — availability checks, duplicate-slot prevention, customer/admin cancellation rules
- **Stripe Checkout** — verified webhook updates payment status only; idempotent event storage
- **Admin operations** — services, appointments, customers, dashboards, read-only transaction ledger
- **ImgBB image uploads** — authenticated, size-limited multipart uploads

---

## Stack

```
src/
  index.ts            Express app, routes, DB connection, HTTP server, shutdown
  config/             env schema, constants, database connection
  models/             User, Service, Appointment, Transaction, WebhookEvent
  controllers/        HTTP parsing and response envelopes
  services/           business rules and persistence
  middleware/         auth, role gates, Zod validation, upload, errors
  lib/                Better Auth config, JWT/JWKS, Stripe and ImgBB clients
  validators/         shared Zod schemas
  utils/              API envelope, AppError, dates, Mongo helpers
```

All route definitions live in `src/index.ts` next to their middleware order. Controllers stay thin and services own business rules. Because Express matches routes in order, `/services/categories`, `/appointments/availability`, and `/appointments/mine` are declared before their `/:id` counterparts, and the Stripe webhook is registered before `express.json()` so it receives the raw body.

Every response uses:

```json
{ "success": true, "data": { }, "message": "optional", "meta": { } }
{ "success": false, "error": { "code": "...", "message": "…", "details": [] } }
```

---

## Data model

| Collection | Purpose |
| --- | --- |
| `user` | Better Auth identity plus `role`, `isBlocked`, `phone` |
| `service` | Treatment menu: name, category, description, price, duration, image, status |
| `appointment` | Customer request with service snapshot, date, slot, status, payment status |
| `transaction` | One Stripe checkout per appointment, unique `appointmentId`, status |
| `webhook_events` | Processed Stripe event IDs for idempotency |

**Design choices**
- **Service snapshots.** Appointments copy `serviceName`, `serviceImage`, `serviceCategory`, and `serviceDuration`. Deleting a service never destroys visit history.
- **One active booking per slot.** A partial unique index on `{ appointmentDate, timeSlot }` where `active: true` enforces this in MongoDB. Cancelling sets `active: false`, releasing the slot.
- **Server-side pricing.** Booking accepts only a service ID, date, slot, and message. Price and duration are read from the service document and stored.
- **One transaction per appointment.** A unique index prevents duplicate checkouts from creating parallel payment records.

---

## Authentication and roles

Better Auth is mounted at `/api/auth/*`. The JWT plugin issues asymmetric tokens; JWKS is at `/api/auth/jwks`.

The API does **not** trust client claims:

1. `authenticate` extracts the bearer token, verifies the signature against JWKS (`${SERVER_URL}/api/auth/jwks`), then reloads the user from MongoDB.
2. Missing or blocked users fail with `403`.
3. `requireAdmin` / `requireCustomer` enforce the database role.
4. Better Auth hooks reject blocked users at sign-in and revoke their sessions.

**Registration rules**
- Public sign-up always creates `role: "customer"`.
- A database hook forces the role on insert, so crafted requests cannot create an admin.
- Password complexity (6+ characters, upper and lower case) is enforced in the auth config.
- Profile updates accept `name`, `phone`, and `image` only; `role` and `isBlocked` are ignored.

**Creating the first admin**

```bash
npm run seed:admin
```

The script is idempotent. Provide credentials via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (or `ADMIN_EMAIL`/`ADMIN_PASSWORD`) for non-interactive runs; otherwise it prompts interactively. Credentials are never hardcoded; passwords are hashed by Better Auth.

A protected `POST /api/admin/setup` endpoint also exists for compatibility, requiring `ADMIN_SETUP_SECRET` and refusing a second admin. There is no public endpoint that can promote an account to admin.

---

## Appointments and availability

State machine:

```
pending ──(admin confirm)──► confirmed ──(Stripe webhook)──► paid
   │                              │
   └──(owner/admin cancel)──► cancelled
```

- Customers create `pending / unpaid` requests only for active services.
- Customers may cancel only their own pending appointments; admins may cancel any non-cancelled appointment.
- Only an admin can confirm, and only from `pending`.
- Only a confirmed, unpaid appointment owned by the customer can start checkout.
- Cancelled appointments are rejected before any Stripe call.
- Availability returns the salon slots for a date with an `available` boolean, excluding active bookings.

---

## Payments

`POST /api/payments/checkout/:id` creates a Stripe Checkout Session and a local `pending` transaction, returning the session URL.

`POST /api/payments/webhook`:
- Mounted before `express.json()` so the raw body is available
- Verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`
- Records the event in `webhook_events` and ignores duplicates
- On `checkout.session.completed` and `checkout.session.async_payment_succeeded`, marks the transaction paid and the appointment `paid`
- On failure/expiry events, marks the transaction failed and keeps the appointment unpaid

No endpoint lets a client mark a payment paid. The success page only reads status.

---

## API overview

All routes are prefixed with `/api`. Better Auth additionally exposes `/api/auth/*` (sign-up, sign-in, token, JWKS, Google callbacks, sign-out).

| Method | Route | Access |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/services` | public |
| GET | `/services/categories` | public |
| GET | `/services/:id` | public |
| POST | `/services` | admin |
| PATCH | `/services/:id` | admin |
| PATCH | `/services/:id/status` | admin |
| DELETE | `/services/:id` | admin |
| GET | `/appointments/availability?date=` | public |
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
| GET | `/payments/status?session_id=` | customer |
| POST | `/payments/webhook` | Stripe signature |
| POST | `/uploads` | authenticated |
| POST | `/admin/setup` | `X-Admin-Setup-Secret` |

---

## Deployment

1. Create the database and set `MONGODB_URI`.
2. Set all production env vars; `BETTER_AUTH_SECRET` must be strong and unique.
3. Build with `npm run build`, start with `npm start`.
4. Set `SERVER_URL` to the API origin and `CLIENT_URL` + `BETTER_AUTH_URL` to the frontend origin.
5. Create the first admin with `npm run seed:admin`, then add services from the admin dashboard. `POST /api/admin/setup` requires `ADMIN_SETUP_SECRET`.
6. Register the Stripe webhook and Google redirect URI for production hosts.
7. Confirm `/health` and `/api/auth/jwks` are reachable over HTTPS.

Because the frontend proxies `/api/auth/*`, `BETTER_AUTH_URL` must be the **frontend** origin while `SERVER_URL` remains the API origin. CORS must allow the frontend origin.

---

## Security notes

- No secrets are returned by any endpoint; transaction responses contain session references, not card data.
- Helmet is enabled, `x-powered-by` is disabled, and CORS is allow-listed.
- Webhook bodies are read raw and verified before parsing into domain actions.
- Every admin route is protected server-side, independent of the UI.
- The setup endpoint requires a long secret and is inert without it.
- Input is validated with Zod at the route boundary; Mongo identifiers are validated before use.

---

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run build       # emit to dist/
```

The API was exercised manually against a scratch MongoDB during development, covering sign-up/role/profile, `401`/`403` access rules, admin-only service creation, server-side pricing, slot conflicts, confirm/cancel ownership, checkout guards, cross-customer access, blocked sessions, invalid webhook signatures, and unknown routes. Real Stripe webhooks and ImgBB uploads were not exercised without credentials.