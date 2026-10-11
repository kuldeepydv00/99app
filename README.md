# 99xmatka - Full-Stack Real-Money Betting Platform

This repository contains the complete production-ready ecosystem for **99xmatka**, a real-money 95x multiplier number betting application.

---

## 📁 Repository Structure

- `/website`: React (Vite) player website. Players install it on their phone as a web app (no Android app / APK).
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

### Web app (install on the phone)
There is no Android app any more. Players open the website and tap **Install App**:
- Android / Chrome: the browser's own install dialog. iPhone: Share → **Add to Home Screen**.
- It opens full screen from the home screen and always runs the latest website, so there is nothing to update.
- `website/public/manifest.webmanifest` + `website/public/icons/` (name, icons), `website/public/sw.js` (offline screen and
  phone notifications), `website/public/offline.html`, `website/src/layout/webApp.tsx` (install button and phone notifications).
- Installing and phone notifications need **HTTPS** (fine on newmatkadomain.com; `localhost` also works for testing).

### Phone notifications (web push)
Players turn them on in the bell (🔔) on the website. Deposits, withdrawals, wins, refunds, wallet changes, admin messages and
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
