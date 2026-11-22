# IPL 2027 MOCK AUCTION SIMULATOR

> **Tagline:** *Build Your Dream IPL Squad.*  
> **Status:** Stage 1 (Single Player) & Stage 2 (Real-Time Multiplayer) Fully Operational  
> **Architecture:** React 19 + TypeScript + Vite + Tailwind CSS + Node.js/Express + Socket.IO

---

## 🏏 Two Distinct Game Modes

### **MODE 1: SINGLE PLAYER AUCTION (SOLO)**
- You select one IPL franchise to manage.
- You are the **sole active bidder** in the auction.
- **Zero AI bidders** — the other 9 franchises remain strictly inactive.
- Every player starts with a **15-second bidding timer** counting down in real seconds.
- Every valid bid placed by you resets the countdown to **15 seconds**.
- The player is only sold when the 15-second countdown finishes at 0.
- If you place no bid in 15 seconds, the player is marked **UNSOLD**.

### **MODE 2: REAL-TIME MULTIPLAYER AUCTION (SOCKET.IO)**
- Connect with friends and other human managers across multiple browsers and devices.
- **Strict Human-Only Rule:** Real human managers only. **NO AI bidders, NO automated bidding bots.**
- Franchises without human managers remain completely inactive.
- **Create Auction Room:** Generates a unique 6-character room code (e.g. `IPL27A`) for the host.
- **Join Auction Room:** Enter the room code and display name to join the live room lobby.
- **Franchise Claiming & Collision Protection:** Each human manager claims 1 franchise. A claimed franchise cannot be taken by another player.
- **Server-Authoritative 15-Second Timer:**
  - Timer runs authoritatively on the server.
  - Every valid bid placed resets the synchronized countdown to 15 seconds across all screens.
  - When countdown reaches 0: player is sold to the highest human bidder or marked unsold if no bids.
- **Host Controls:** Host can configure minimum players, start the auction, pause/resume, and advance lots.
- **Live Bid Ticker & Overlays:** Every paddle raise broadcasts in real time with the manager's name and franchise badge.

---

## 🏟️ The 10 Official IPL Franchises
1. **Mumbai Indians (MI)**
2. **Chennai Super Kings (CSK)**
3. **Royal Challengers Bengaluru (RCB)**
4. **Kolkata Knight Riders (KKR)**
5. **Sunrisers Hyderabad (SRH)**
6. **Rajasthan Royals (RR)**
7. **Punjab Kings (PBKS)**
8. **Gujarat Titans (GT)**
9. **Delhi Capitals (DC)**
10. **Lucknow Super Giants (LSG)**

Each franchise starts with a purse of **₹120.00 Cr** and tracks squad capacity (max 25, min 18, max 8 overseas).

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Full-Stack Server & Frontend (Vite + Express + Socket.IO)
```bash
npm run dev:all
```
- Frontend runs on: `http://localhost:5173`
- Backend API + Socket.IO runs on: `http://localhost:3001`
*(Proxy is automatically configured so Socket.IO connects seamlessly on port 5173 or 3001).*

### 3. Run Automated Engine & Multiplayer Test Suite
```bash
npm test
```
Runs both:
- Single Player 15-Second Countdown & Solo Validation Tests
- Real-Time Multiplayer Socket.IO WebSocket Integration Tests (real connected sockets, room creation, join, team locking, bidding, countdown reset)

### 4. Build for Production
```bash
npm run build
```
Creates a production-optimized build in `dist/`.

---

## 🧪 Testing Multiplayer with Real Browser Tabs
1. Open `http://localhost:5173` in Browser Tab 1.
2. Select **MULTIPLAYER AUCTION** -> **Create Room** -> Enter name (e.g. `Rohit`).
3. Note the generated 6-character Room Code (e.g. `VKNZL5`).
4. Select your franchise (e.g. `MI`).
5. Open `http://localhost:5173` in Browser Tab 2 (or in Incognito / another device on same network).
6. Select **MULTIPLAYER AUCTION** -> **Join Room** -> Enter the code and name (e.g. `Virat`).
7. Notice that `MI` is locked! Select another franchise (e.g. `RCB`).
8. Ready up in both tabs.
9. Click **Start Live Auction** in Tab 1 (Host).
10. Both tabs transition into the live auction room with synchronized 15-second countdowns, real-time bid updates, and hammer animations!
