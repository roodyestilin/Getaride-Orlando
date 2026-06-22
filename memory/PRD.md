# Getaride Orlando — Product Requirements (PRD)

## Original Problem Statement
Production-ready ride-sharing app for the Orlando market. Unlike Uber, drivers can view trip
details and either accept the suggested fare or submit a custom fare within an allowed range.
Customers compare up to 5 offers and choose their preferred driver. Customer features: registration
(email/phone OTP/Google/Apple), ride request (pickup, destination, optional stops, ride now / schedule),
fare marketplace (recommended fare → driver offers → pick), real-time tracking + in-app messaging.

## v1 Scope & User Choices (locked)
- Single Expo (iOS/Android) app with BOTH Customer + Driver modes (role chosen at signup).
- Full fare marketplace with SIMULATED drivers (so flow is demoable end-to-end).
- Auth: Email + Password (JWT). (Phone OTP / Google / Apple deferred.)
- Maps & live tracking: custom SVG simulated map + time-based simulated tracking (Mapbox keys to be added later).
- Basic in-app chat (auto-reply from simulated counterpart).
- Branding: vivid purple (#9333ea), PlusJakartaSans (text) + SpaceGrotesk (numbers).

## Architecture
- Frontend: Expo Router, file-based routing. Groups: `(customer)` tabs (Ride/Activity/Account),
  `(driver)` tabs (Drive/Earnings/Account); stack screens `ride/[id]`, `driver-trip/[id]`, `chat/[id]`, `auth`.
  Shared: `src/api.ts`, `src/auth.tsx` (JWT context), `src/components/*` (MapView, PlacePicker, Button, Avatar, Logo).
- Backend: FastAPI + MongoDB (motor). JWT (pyjwt) + bcrypt. All routes under `/api`.
  Collections: users, rides, offers, messages. UUID string ids (no ObjectId leakage).
- Real-time via 2–3s client polling. Driver GPS, status progression, offer reveal, bid auto-accept,
  and chat replies are simulated as functions of elapsed time.

## Personas
- Rider: requests a ride, compares driver offers, picks best price/ETA/rating, tracks & chats.
- Driver: goes online, sees nearby requests, accepts recommended or submits custom fare, runs the trip.

## Implemented (2026-06-22)
- Auth: register (customer/driver), login, /auth/me. (Verified 22/22 backend tests.)
- Customer: ride request w/ pickup/destination/stops, Ride Now & Schedule presets; fare marketplace
  with up to 5 progressively-revealed bid cards; offer selection; live tracking w/ moving driver + ETA
  + status; trip completion; activity history.
- Driver: online/offline; nearby simulated requests; custom-fare stepper within allowed range +
  "Accept Recommended"; bid auto-accept; trip status advance (arrived→in progress→completed); earnings + history.
- Chat: rider↔driver messaging with auto-replies.
- Design system applied (purple, glass header, mono fonts for fare/ETA, haptics).

## Backlog / Remaining
- P0: Real Mapbox integration (keys pending from user); ownership checks on ride-mutating endpoints.
- P1: Phone OTP, Google & Apple login; real driver matching (replace simulation); scheduled-ride
  reminders; cancellation fees/policies; driver earnings payouts.
- P2: Web Admin Dashboard; ratings after trip; promo codes; surge logic; multiple vehicle classes.
- Tech debt: split server.py into routers; replace deprecated RN-Web `shadow*` with `boxShadow`.

## Next Tasks
1. Wire Mapbox once API key is provided (swap `src/components/MapView.tsx` projection for real tiles).
2. Add per-ride ownership authorization on select/cancel/track/driver-status.
3. Add post-trip rating flow.
