# Real Estate Voice Agent — Rehman Estates

Pakistani property **AI front desk**: inbound callers talk to **Tareeq (طارق)** in Urdu, Punjabi, or English. The agent captures requirements, searches inventory, answers market questions, and writes leads into an ops dashboard.

Built with Vite/React, Express, and [Uplift AI](https://upliftai.org) realtime voice assistants.

---

## Architecture

| Service | Path | Port | Role |
|---------|------|------|------|
| **API** | `Rehman-Estates-Shell/artifacts/api-server` | **3001** | Listings, knowledge base, leads, visits, handoffs |
| **Voice app** | `backend/` | **5000** | Live call UI + tool handlers |
| **Dashboard** | `Rehman-Estates-Shell/artifacts/rehman-estates` | **5173** | Ops: leads, stats, call preview |

```
Caller / preview call → Uplift session → browser tools → POST /api/* → dashboard
```

---

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **pnpm** (`npm i -g pnpm`)
- Modern browser with microphone access (Chrome recommended)
- Network access to `api.upliftai.org` (public assistants)

---

## Quick start

### 1. Install

```bash
cd real-estate-voice-agent

# Root (concurrently)
npm install

# Voice app
pnpm --dir backend install

# Shell monorepo (API + dashboard)
pnpm --dir Rehman-Estates-Shell install
```

### 2. Environment

```bash
cp backend/.env.example backend/.env
cp Rehman-Estates-Shell/artifacts/rehman-estates/.env.example \
   Rehman-Estates-Shell/artifacts/rehman-estates/.env
```

`.env.example` includes public Uplift assistant IDs and local API URLs. Replace IDs if you use your own assistants.

### 3. Run (three terminals)

**Terminal A — API**

```bash
cd Rehman-Estates-Shell
pnpm --filter @workspace/api-server run build
PORT=3001 pnpm --filter @workspace/api-server run start
```

**Terminal B — Voice front desk**

```bash
cd backend
pnpm run dev
```

Open http://localhost:5000

**Terminal C — Dashboard**

```bash
cd Rehman-Estates-Shell
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/rehman-estates run dev
```

Open http://localhost:5173

### Shortcut: API + voice only

From repo root:

```bash
npm run dev
```

Starts API (`:3001`) and voice app (`:5000`). Start the dashboard separately as in Terminal C.

---

## Agent tools

| Tool | Purpose |
|------|---------|
| `update_lead` | Save buyer requirements (intent, size, society, budget, contact) |
| `search_listings` | Search inventory (up to 3 matches) |
| `answer_property_question` | Market / process Q&A from knowledge base |
| `schedule_visit` | Book a site visit |
| `handoff_to_dealer` | Flag human dealer callback |
| `switch_language` | Switch Urdu / Punjabi / English desk |
| `get_call_context` | Reload lead context after a language switch |

---

## Data files

| File | Description |
|------|-------------|
| `Rehman-Estates-Shell/artifacts/api-server/src/data/listings.json` | ~40 sample listings |
| `Rehman-Estates-Shell/artifacts/api-server/src/data/knowledge-base.json` | ~24 Q&A topics (file vs possession, bayana, NOC, …) |
| `Rehman-Estates-Shell/artifacts/api-server/data/persisted-store.json` | Runtime leads/visits (gitignored; created on first write) |

---

## Demo script (2–3 min)

1. Open dashboard → start **preview call** (or use voice app on `:5000`).
2. Ask for a **5 marla plot in DHA** around **2–3 crore**.
3. Ask **file vs possession** or **bayana**.
4. Give a **name + phone** → check **Leads** on the dashboard.
5. Optional: switch to Punjabi/English; schedule a visit; request dealer handoff.

Allow the microphone when prompted. Prefer a normal browser tab (not a restricted iframe).

---

## API health check

```bash
curl http://localhost:3001/api/healthz
curl http://localhost:3001/api/leads
```

---

## Project layout

```
.
├── backend/                          # Voice front desk (Vite + React)
├── Rehman-Estates-Shell/
│   └── artifacts/
│       ├── api-server/               # Express API
│       └── rehman-estates/           # Ops dashboard
├── package.json                      # Root: npm run dev (API + voice)
└── README.md
```

---

## Notes for developers

- Leads are stored in a **JSON file** on the API host (demo persistence, not a full DB).
- Language switch creates a **new Uplift session**; the app re-injects known lead/listing context.
- Do **not** commit `.env` files; use `.env.example` only.
- Dashboard proxies `/api` → `localhost:3001` when `VITE_API_BASE` is empty.

---

## License

Private / demo project — adjust as needed for your org.
