# 99xmatka - Full-Stack Real-Money Betting Platform

This repository contains the complete production-ready ecosystem for **99xmatka**, a real-money 95x multiplier number betting application.

---

## 📁 Repository Structure

- `/website`: React (Vite) player website (the casino lobby, like Stake). Works on Android and iPhone.
- `/android-app`: the Android app (APK). It has no screens of its own: it opens the website full screen.
- `/backend`: Node.js + Express + Socket.io + MongoDB API server locked to **Indian Standard Time (IST)**.
- `/admin-panel`: React (Vite) + Tailwind CSS web dashboard for draw scheduling and 95x result declaration.

---

## ⚡ Financial & Game Rules Enforced

1. **Multiplier**: **95×** on all winning bets (`win_amount = bet_amount × 95`).
2. **Minimum Bet Limit**: **₹ 10**
3. **Minimum Deposit Limit**: **₹ 100**
4. **Minimum Withdrawal Limit**: **₹ 500**

---

## ⏰ Official Game Schedules (IST / Asia/Kolkata)

| Game | Open Time | Close Time | Result Time |
| :--- | :--- | :--- | :--- |
| **Gali** | 01:00 AM IST | 11:00 PM IST | 11:30 PM IST |
| **Ghaziabad** | 01:00 AM IST | 09:00 PM IST | 09:40 PM IST |
| **Faridabad** | 01:00 AM IST | 05:30 PM IST | 06:15 PM IST |
| **Desawar** | 06:00 AM IST | 02:30 AM IST *(Next Day)* | 05:15 AM IST |

---

## 🚀 Quick Start Guide

### 1. Run Backend Server
```bash
cd backend
npm install
npm run dev
# Server running on http://localhost:5002 (Timezone: Asia/Kolkata IST)
```

### 2. Run Web Admin Panel
```bash
cd admin-panel
npm install
npm run dev
# Admin Panel accessible at http://localhost:5173
```

### 3. Run the Website (player web app)
```bash
cd website
npm install
npm run dev
# Website at http://localhost:5174
```

### The 99xmatka app (web app)
The app is the website, installed from the browser. Every **Download App** button (top bar, menu, footer,
offer card, and a pop-up Android phones see once a day) opens the browser's own **Install app** dialog:
one tap and 99xmatka is in the app list / home screen, opens full screen, and gets phone notifications.
Works in Chrome, Edge and Samsung Internet on Android and on computers. Website updates show in the app
straight away: there is nothing to rebuild or update.
- Files: `website/public/manifest.webmanifest` (name, icons, screenshots shown in the install dialog),
  `website/public/icons/`, `website/public/screenshots/`, `website/public/sw.js`, `website/src/layout/webApp.tsx`.
- Needs **HTTPS** (fine on newmatkadomain.com; `localhost` also works for testing).
- iPhone: Safari has no install dialog, so Download App shows the steps (Share → Add to Home Screen).
- Browsers with no install dialog (e.g. Firefox): Download App shows the steps, or downloads the APK if one
  is uploaded at `/99xmatka.apk`.

### Optional: Android APK (`/android-app`)
Only needed as the fallback above. It opens the website full screen (Trusted Web Activity).
1. Open `android-app` in Android Studio and let it sync.
2. Terminal: `./gradlew assembleRelease` → copied to `website/public/99xmatka.apk` (not in git), then deploy the website.
- Signing key `android-app/app/debug.keystore` (not in git; keep a backup). Its fingerprint is in
  `website/public/.well-known/assetlinks.json`, which must be online for the APK to open without an address bar.

### Phone notifications (web push)
Players turn them on in the bell (🔔), on the website or in the Android app. Deposits, withdrawals, wins, refunds, wallet changes, admin messages and
declared results then pop up on their phone, even when the app is closed (iPhone: only after installing to the home screen).
- Sent by `backend/src/utils/webPush.js` (no extra packages). The server needs outgoing HTTPS to the browsers' push services
  (fcm.googleapis.com, web.push.apple.com, push.services.mozilla.com, notify.windows.com).
- Server keys: set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in `backend/.env`, or leave them out and the
  server makes a pair once and keeps it in `dataStore.json`. Never change the keys afterwards: phones that turned
  notifications on would stop getting them until each player turns them on again.

---

## 📡 API Endpoints Summary

### Public / User
- `POST /api/game/bet` — Place single or multiple bets with 95x payout calculation.
- `GET /api/game/my-bets` — Fetch user bet history.
- `GET /api/game/results` — Fetch latest draw results.

### Admin
- `POST /api/admin/declare-result` — Upload game winning number (00-99), calculate 95x payouts, credit winner wallets, and emit WebSocket notifications.
- `GET /api/admin/stats` — Dashboard analytics (Users, Bet Volume, Platform Profit).

---

## 🔒 Provably Fair Verification Engine
- Server seed generated and hashed prior to draw announcement.
- Winning numbers evaluated using SHA256 hashes (`hash(server_seed + draw_time)`).
