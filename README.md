# VELTO Food Palace

A full-stack food delivery platform built for a cloud-kitchen / single-brand delivery operation. It covers the entire order lifecycle — from customer checkout to kitchen prep to rider dispatch to payout — across three apps sharing one backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Backend                          │
│              Node.js + Express + PostgreSQL             │
│         Socket.IO  ·  BullMQ  ·  Redis  ·  Firebase    │
└────────────┬──────────────┬───────────────┬────────────┘
             │              │               │
     ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
     │  Customer &  │ │   Admin /  │ │  Rider + Kitchen│
     │  Web Portal  │ │  Finance   │ │  Mobile App     │
     │  (Next.js)   │ │  (Next.js) │ │ (React Native) │
     └──────────────┘ └────────────┘ └────────────────┘
```

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, TypeScript, PostgreSQL, Redis, BullMQ, Socket.IO |
| Web (Customer + Admin) | Next.js 15, React, Tailwind CSS, Framer Motion, Leaflet |
| Mobile (Rider + Kitchen) | React Native (New Architecture / Fabric), NativeWind, Redux Toolkit, React Query |
| Payments | Razorpay (checkout + payouts) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Media | Cloudinary / ImageKit |
| Maps | Leaflet (web), React Native Maps (mobile) |

---

## Monorepo Structure

```
/
├── backend/          # Express API server
│   ├── src/
│   │   ├── routes/   # REST endpoints per domain
│   │   ├── services/ # Business logic
│   │   ├── config/   # Constants, env, DB
│   │   └── crons/    # Scheduled jobs
│   └── Dockerfile
│
├── web/              # Next.js web app
│   └── app/
│       ├── (customer pages)
│       ├── admin/    # Admin panel tabs
│       ├── kitchen/  # Kitchen portal
│       ├── rider/    # Rider web view
│       └── finance/  # Finance dashboard
│
├── mobile/           # React Native app
│   └── src/
│       ├── screens/  # ~40 screens (customer, rider, kitchen)
│       ├── services/ # Push, socket, API
│       └── config/
│
└── docker-compose.yml
```

---

## Features

### Customer
- OTP phone login, onboarding, address book (map pin picker)
- Menu browsing, cart, item details with daily limits
- Checkout with promo codes, wallet, loyalty points, rider tip
- Razorpay payment gateway + wallet top-up
- Subscription meal plans with per-day credits
- Live order tracking (Socket.IO + Leaflet map)
- Order history, invoices, ratings, complaints
- Loyalty rewards, referral program
- Scheduled orders, campaign banners

### Rider (Mobile)
- Rider onboarding + verification flow
- Real-time order assignment with batch support
- Live map navigation (Google Maps Directions)
- Delivery OTP confirmation, door-step cash collection
- Shift handover, earnings dashboard
- UPI payout request + QR code display
- Background location tracking

### Kitchen
- Kitchen login (separate role)
- Live order board (KDS) — new orders appear in real time
- Morning prep screen (daily item stock management)
- Mark items sold / unavailable
- Batch view for grouped orders

### Admin Panel (Web)
- Dashboard with real-time dispatch log
- Menu management (items, categories, daily limits)
- Zone management (delivery zones with polygon maps)
- Kitchen health monitoring
- Promo codes, campaigns, banners
- Team management (riders, kitchen staff)
- Finance dashboard (revenue, payouts, settlements)
- Push notification broadcasts
- Complaints & service requests

---

## Pricing Engine

All order pricing is computed server-side in `backend/src/services/payment.service.ts`:

| Component | Value |
|---|---|
| Delivery fee | Rs. 25 (configurable per zone) |
| Subscriber delivery | Rs. 0 (free) |
| GST | 5% (2.5% CGST + 2.5% SGST) — legally fixed |
| Loyalty discount | Points redeemable at checkout |
| Surge | Zone-based multiplier (configurable) |
| Wallet | Partial or full payment from wallet balance |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Android Studio / Xcode for mobile

### Backend

```bash
cd backend
cp .env.example .env   # fill in DB, Redis, Razorpay, Firebase keys
npm install
npm run migrate        # run DB migrations
npm run dev
```

### Web

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

### Mobile

```bash
cd mobile
npm install
npx react-native run-android   # or run-ios
```

Or with Docker (backend + Redis + Postgres):

```bash
docker-compose up
```

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `REDIS_URL` | Backend | Redis for BullMQ + Socket.IO adapter |
| `JWT_SECRET` | Backend | Auth token signing |
| `RAZORPAY_KEY_ID / SECRET` | Backend | Payment gateway |
| `RAZORPAY_ACCOUNT_NUMBER` | Backend | Payout source account |
| `FIREBASE_SERVICE_ACCOUNT` | Backend | FCM push notifications |
| `CLOUDINARY_URL` | Backend | Image uploads |
| `NEXT_PUBLIC_API_URL` | Web | Backend base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY` | Web | Client-side Razorpay key |
| `API_BASE_URL` | Mobile | Backend base URL |

---

## Key API Domains

| Route prefix | Responsibility |
|---|---|
| `/auth` | OTP login, token refresh |
| `/menu` | Items, categories |
| `/payment` | Pricing calculation, checkout, wallet |
| `/order` | Order lifecycle, tracking |
| `/rider` | Assignment, location, earnings |
| `/kitchen` | KDS, stock, prep |
| `/admin` | All admin operations |
| `/finance` | Revenue, payout management |
| `/subscription` | Meal plans |
| `/notifications` | FCM broadcasts |

---

## License

Private — all rights reserved.
