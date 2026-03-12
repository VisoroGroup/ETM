# 🧠 ETM — Visoro Task Manager — Project Brain

> Central tudásbázis az ETM projekthez. Minden beszélgetés és döntés ide kerül.

---

## Projekt áttekintés

| | |
|---|---|
| **Név** | Visoro Task Manager (ETM) |
| **Cég** | Visoro Global SRL |
| **Repo** | [github.com/VisoroGroup/ETM](https://github.com/VisoroGroup/ETM) |
| **Deploy** | [etm-production-62a7.up.railway.app](https://etm-production-62a7.up.railway.app) |
| **Railway** | [railway.com/project/3efad570-...](https://railway.com/project/3efad570-3441-4bbc-9879-a2a4cc76f6da) |
| **Nyelv** | Interfész: **Román** · Fejlesztés: **Magyar/Angol** |

---

## Tech stack

| Layer | Technológia |
|-------|-------------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 (Vite) |
| Backend | Express.js + TypeScript |
| DB | PostgreSQL 15 (Railway managed) |
| Auth | Microsoft Entra ID / JWT (dev bypass mód) |
| Email | Microsoft Graph API (placeholder) |
| Scheduler | node-cron (07:00 Europe/Bucharest, Mon-Fri) |
| Icons | lucide-react |
| Charts | Recharts |
| DnD | @hello-pangea/dnd |
| Deploy | Railway (Dockerfile, multi-stage node:20-alpine) |

---

## Projekt struktúra

```
ETM/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # auth/, dashboard/, layout/, tasks/
│   │   ├── hooks/       # useAuth, useToast
│   │   ├── services/    # api.ts (axios)
│   │   ├── types/       # TypeScript interfaces
│   │   └── utils/       # helpers (date-fns, ro locale)
│   └── vite.config.ts   # Tailwind plugin + API proxy
├── server/              # Express backend
│   ├── src/
│   │   ├── config/      # database.ts (Pool, SSL)
│   │   ├── cron/        # emailScheduler.ts
│   │   ├── database/    # 10 SQL migrations + seed.ts + migrate.ts
│   │   ├── middleware/   # auth.ts (JWT)
│   │   ├── routes/      # auth, tasks, dashboard, upload
│   │   ├── types/       # server-side interfaces
│   │   └── utils/       # dateUtils.ts
│   └── app.ts           # Express entry (serves frontend in prod)
├── Dockerfile           # Multi-stage build for Railway
├── railway.json         # DOCKERFILE builder config
└── docker-compose.yml   # Local PostgreSQL
```

---

## Adatbázis táblák

`users` · `tasks` · `task_status_changes` · `task_due_date_changes` · `subtasks` · `task_comments` · `task_attachments` · `activity_log` · `recurring_tasks` · `email_logs`

---

## Üzleti szabályok

1. **Blocat status** → kötelező `reason` mező (modal a frontenden)
2. **Dátum változtatás** → kötelező `reason` mező (modal a frontenden)
3. **Activity log** → minden változás automatikusan naplózódik
4. **Recurring tasks** → befejezéskor automatikusan létrehozza a következőt
5. **Email emlékeztetők** → 3 fázis: lejárt, utolsó 7 nap, heti

---

## Environment változók (Railway)

| Változó | Érték |
|---------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `visoro-etm-jwt-secret-2024-prod` |
| `DEV_AUTH_BYPASS` | `true` |
| `PORT` | `8080` |

---

## Beszélgetés napló

### 2026-03-10 — Projekt létrehozás + első deploy
**Conversation ID:** `5ea05c13-c273-431a-a7e0-8798a52537d4`

**Elvégzett munka:**
- ✅ Teljes backend megépítése (Express + TS): auth, tasks CRUD, subtasks, comments, attachments, activity log, dashboard, recurring, email scheduler
- ✅ 10 SQL migráció + seed adat
- ✅ Teljes frontend megépítése (React + TS + Tailwind): login, dashboard (Recharts), task list (filters/search), task drawer (4 tab: subtasks DnD, comments @mention, files, activity)
- ✅ GitHub push → `VisoroGroup/ETM`
- ✅ Railway konfiguráció: PostgreSQL, env vars, domain generálás

**Problémák és megoldások:**
1. **Nixpacks build fail** (`npm: command not found`) → Megoldás: explicit `Dockerfile` (multi-stage node:20-alpine)
2. **TS1484 type import hibák** → Megoldás: `verbatimModuleSyntax: false` a tsconfig-ban
3. **Migration crash** (`Cannot find module '../config/database'`) → Megoldás: teljes `server/src` másolása a Docker runner stage-be
4. **Railway deployment slowness** — platform szintű incidens, nem a mi hibánk

**Jelenlegi státusz:** Deploy folyamatban, utolsó Dockerfile fix pushcolva (2026-03-11 08:30).

---

*Utolsó frissítés: 2026-03-11*
