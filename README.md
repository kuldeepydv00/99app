# 99xmatka - Full-Stack Real-Money Betting Platform

This repository contains the complete production-ready ecosystem for **99xmatka**, a real-money 95x multiplier number betting application.

---

## 📁 Repository Structure

- `/android-app`: Kotlin + Jetpack Compose Android app (MVVM Clean Architecture).
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

### 3. Run Android App
1. Open **Android Studio**.
2. Select **Open** -> Choose `/Users/kuldeep/app 2/android-app`.
3. Press **Run ▶** to launch on Emulator.

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
