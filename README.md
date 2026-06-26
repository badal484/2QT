# 2QT — Food Delivery Platform

A full-stack food delivery platform built for a cloud-kitchen operation. Covers the entire order lifecycle — customer ordering → kitchen prep → rider dispatch → payout — across **one backend** serving **five distinct apps**.

---

## Apps Overview

| App | Tech | Who uses it | What it does |
|---|---|---|---|
| **Customer Web** | Next.js (PWA) | Customers | Browse menu, place orders, track delivery live, manage wallet/subscriptions/loyalty |
| **Admin Panel** | Next.js (same codebase, `/admin` route) | Super admin | Manage menu, zones, kitchens, riders, promos, campaigns, dispatch, finance |
| **Finance Dashboard** | Next.js (same codebase, `/finance` route) | Finance team | Revenue overview, rider payouts, kitchen payouts, COD settlements, transactions |
| **Kitchen Portal** | Next.js (same codebase, `/kitchen` & `/kitchen-portal` routes) | Kitchen staff (web) | Live KDS — incoming orders, prep status updates |
| **Mobile App** | React Native (single APK, role-based) | Customers · Riders · Kitchen staff · Admins | One app, four roles — each role gets its own navigator and screen set |

The web app is one Next.js project. The mobile app is one React Native project. Role is determined at login and drives navigation in both.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          Backend                             │
│             Node.js · Express · TypeScript · PostgreSQL      │
│          Socket.IO · BullMQ · Redis · Firebase FCM           │
└──────┬───────────┬────────────┬──────────────┬──────────────┘
       │           │            │              │
  ┌────▼────┐ ┌────▼────┐ ┌────▼────┐   ┌────▼────────────────┐
  │Customer │ │  Admin  │ │Finance / │   │   Mobile App (RN)   │
  │  Web    │ │  Panel  │ │ Kitchen  │   │ Customer / Rider /  │
  │ (PWA)   │ │         │ │ Portals  │   │ Kitchen / Admin     │
  └─────────┘ └─────────┘ └─────────┘   └─────────────────────┘
        ◄── all served from the same Next.js project ──►
```

| Layer | Tech |
|---|---|
| Backend API | Node.js, Express, TypeScript · port 8000 · routes at `/api/v1` |
| Database | PostgreSQL |
| Cache / Queues | Redis + BullMQ (notifications, invoices) |
| Realtime | Socket.IO (order status, rider location, dispatch) |
| Web frontend | Next.js 15, Tailwind CSS, Framer Motion, Leaflet |
| Mobile | React Native (New Architecture / Fabric), NativeWind, Redux Toolkit, React Query |
| Payments | Razorpay — checkout, wallet top-up, UPI payouts |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Media | Cloudinary / ImageKit |
| Maps | Leaflet (web), React Native Maps + Google Directions (mobile) |

---

## Monorepo Structure

```
/
├── backend/
│   ├── src/
│   │   ├── routes/          # One file per domain (auth, order, payment, rider, kitchen, admin, finance…)
│   │   ├── services/        # Business logic (order, payment, invoice, loyalty, push, payout…)
│   │   ├── config/          # Constants, env, DB connection
│   │   └── crons/           # Scheduled jobs
│   └── Dockerfile
│
├── web/                     # Single Next.js app — all portals
│   └── app/
│       ├── page.tsx         # Customer landing / home
│       ├── menu/            # Menu browsing
│       ├── orders/          # Order tracking
│       ├── profile/         # Customer profile, wallet, loyalty
│       ├── subscription/    # Meal plan management
│       ├── admin/           # Admin panel (tabs: Menu, Zones, Kitchens, Riders, Promos, Dispatch, etc.)
│       ├── finance/         # Finance dashboard (overview, payouts, COD, transactions)
│       ├── kitchen/         # Kitchen order board (KDS)
│       ├── kitchen-portal/  # Kitchen partner portal
│       ├── rider/           # Rider web view
│       ├── become-a-rider/  # Rider onboarding / application
│       └── partner/         # Kitchen partner onboarding
│
└── mobile/                  # Single React Native app — role-based navigators
    └── src/
        ├── navigation/
        │   ├── RootNavigator.tsx      # Picks navigator based on user role
        │   ├── CustomerNavigator.tsx
        │   ├── RiderNavigator.tsx
        │   ├── KitchenNavigator.tsx
        │   └── AdminNavigator.tsx
        ├── screens/
        │   ├── (customer screens)     # Home, Cart, Checkout, Tracking, Wallet, Loyalty, etc.
        │   ├── (rider screens)        # RiderHome, AssignedOrder, Earnings, Payouts, Batch, etc.
        │   ├── (kitchen screens)      # KitchenBoard, LiveKitchen, MorningPrep, Stock, etc.
        │   └── admin/                 # Dashboard, LiveOrders, MenuManager, Riders, Payouts, etc.
        └── services/                  # Push, socket, API client
```

---

## Feature Highlights

### Customer (Web + Mobile)
- Phone OTP login, address book with map pin picker
- Menu with daily limits, cart, promo codes, wallet, loyalty points, rider tip
- Razorpay payment + wallet top-up
- Subscription meal plans with per-day credits
- Live order tracking on map (Socket.IO)
- Scheduled orders, referral program, in-app complaints
- PDF invoices

### Rider (Mobile only)
- Onboarding + verification flow
- Real-time order assignment, batch delivery support
- Live map navigation (Google Directions)
- Delivery OTP confirmation, door-step cash collection
- Shift handover, earnings dashboard
- UPI payout request with QR code

### Kitchen Staff (Mobile + Web portal)
- Live KDS — new orders appear in real time via Socket.IO
- Morning prep screen — set daily stock per item
- Mark items unavailable / sold out
- Batch order view

### Admin (Web panel + Mobile admin screens)
- Real-time dispatch log
- Menu, zones (polygon maps), kitchens, rider management
- Promo codes, campaign banners, push notification broadcasts
- Finance: revenue, rider payouts, kitchen payouts, COD settlements
- Complaints & service requests, kitchen health monitoring

---

## Pricing Engine

Computed server-side in `backend/src/services/payment.service.ts` before every checkout:

| Component | Logic |
|---|---|
| Delivery fee | Flat Rs. 25 (free for subscribers) — zone-configurable |
| Discount | Promo code (% or flat) |
| Loyalty discount | Points redeemed at checkout (capped at % of subtotal) |
| GST | 5% on discounted subtotal (2.5% CGST + 2.5% SGST — legally fixed) |
| Wallet | Partial/full deduction from customer wallet balance |
| Rider tip | Optional, added on top |

---

## Getting Started

### Prerequisites
- Node.js 20+, PostgreSQL 15+, Redis 7+
- Android Studio / Xcode for mobile

### Backend
```bash
cd backend
cp .env.example .env   # fill DB, Redis, Razorpay, Firebase keys
npm install
npm run dev            # port 8000
```

### Web
```bash
cd web
cp .env.example .env.local
npm install
npm run dev            # port 3000
```

### Mobile
```bash
cd mobile
npm install
npx react-native run-android
```

Or spin up the full stack with Docker:
```bash
docker-compose up
```

---

## Key Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection |
| `REDIS_URL` | Backend | Redis (BullMQ + Socket.IO adapter) |
| `JWT_SECRET` | Backend | Auth token signing |
| `RAZORPAY_KEY_ID/SECRET` | Backend | Payment gateway |
| `RAZORPAY_ACCOUNT_NUMBER` | Backend | UPI payout source |
| `FIREBASE_SERVICE_ACCOUNT` | Backend | FCM push notifications |
| `CLOUDINARY_URL` | Backend | Image uploads |
| `NEXT_PUBLIC_API_URL` | Web | Backend base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY` | Web | Client-side Razorpay key |
| `API_BASE_URL` | Mobile | Backend base URL |

---

## License

Private — all rights reserved.
