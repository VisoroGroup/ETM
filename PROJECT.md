# 🧠 ETM — Visoro Task Manager — Project Brain

> Central tudásbázis az ETM projekthez.

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
| Email | Microsoft Graph API (placeholder — TODO) |
| Scheduler | node-cron (07:00 Europe/Bucharest, Mon-Fri) |
| Icons | lucide-react |
| Charts | Recharts |
| DnD | @hello-pangea/dnd |
| Font | Inter (Google Fonts) |
| Deploy | Railway (Dockerfile, multi-stage node:20-alpine) |

---

## Projekt struktúra

```
ETM/
├── client/              # React frontend (Vite)
│   └── src/
│       ├── App.tsx      # Router + AuthProvider + ToastProvider
│       ├── components/
│       │   ├── auth/         # LoginPage
│       │   ├── dashboard/    # DashboardPage (Recharts)
│       │   ├── layout/       # Layout (sidebar, dark mode toggle)
│       │   └── tasks/        # TaskListPage, TaskDrawer, TaskFormModal
│       ├── hooks/            # useAuth, useToast
│       ├── services/         # api.ts (axios)
│       ├── types/            # TypeScript interfészek + konstansok
│       └── utils/            # helpers (date-fns, ro locale)
├── server/
│   └── src/
│       ├── app.ts            # Express entry (prod-ban frontend-et is serve-el)
│       ├── config/           # database.ts — pg Pool, SSL prod-ban
│       ├── cron/             # emailScheduler.ts — napi email összefoglaló
│       ├── database/
│       │   ├── migrations/   # 001–011 SQL migrációk
│       │   ├── migrate.ts    # Migration runner
│       │   └── seed.ts       # Dev seed adatok
│       ├── middleware/        # auth.ts — JWT + generateToken + requireRole
│       ├── routes/           # auth.ts, tasks.ts, dashboard.ts, upload.ts
│       ├── types/            # Server-side interfészek
│       └── utils/            # dateUtils.ts
├── Dockerfile            # Multi-stage: builder + runner
├── railway.json          # DOCKERFILE builder, restart on failure
└── docker-compose.yml    # Lokális PostgreSQL (port 5432)
```

---

## Adatbázis táblák (11 migráció)

| Tábla | Leírás |
|-------|--------|
| `users` | microsoft_id, email, display_name, avatar_url, department, role |
| `tasks` | title, description, status, due_date, created_by, department_label |
| `task_status_changes` | old/new_status, reason (kötelező ha blocat), changed_by |
| `task_due_date_changes` | old/new_date, reason (mindig kötelező), changed_by |
| `subtasks` | task_id, title, is_completed, assigned_to, order_index |
| `task_comments` | task_id, author_id, content, mentions[] |
| `task_attachments` | task_id, file_name, file_url, file_size, uploaded_by |
| `activity_log` | task_id, user_id, action_type, details (JSON) |
| `recurring_tasks` | template_task_id, frequency, next_run_date, is_active |
| `email_logs` | user_id, task_ids[], email_type, status, error_message |
| `task_alerts` | task_id, created_by, content, is_resolved, resolved_by, resolved_at |

**ENUMok:** `user_role` (admin/manager/user) · `department_type` (departament_1..7) · `task_status` (de_rezolvat/in_realizare/terminat/blocat) · `recurring_frequency` (daily/weekly/biweekly/monthly)

---

## API végpontok

### Auth (`/api/auth`)
- `POST /login` — Microsoft token VAGY dev bypass
- `GET /me` — Aktuális user
- `GET /users` — Összes user
- `PUT /users/:id` — Role/department (admin only)

### Tasks (`/api/tasks`)
- `GET /` — Lista szűrőkkel (status, department, search, period, recurring, assigned_to, page, limit)
- `POST /` — Új task
- `GET /:id` — Részletek (subtasks, comments, attachments, activity, **alerts**)
- `PUT /:id` — Title/description/department
- `PUT /:id/status` — ⚠️ blocat → reason kötelező → recurring auto-create
- `PUT /:id/due-date` — ⚠️ reason mindig kötelező
- `DELETE /:id` — Creator vagy admin
- Subtask CRUD + reorder (DnD)
- Comment CRUD + @mention
- Attachment upload/delete
- Alert CRUD + resolve (`PUT /:id/alerts/:alertId/resolve`)
- Activity log GET
- Recurring set/delete

### Dashboard (`/api/dashboard`)
- `GET /stats` — Aktív, Lejárt, Blocat, Havi befejezett, Összesen
- `GET /charts` — Status/dept distribution, completion trend (4 hét), urgent top 10

---

## TaskDrawer — 5 fül

| # | Fül | Tartalom |
|---|-----|---------|
| 1 | Subtask-uri | DnD rendezés, user assign, completion |
| 2 | Comentarii | @mention dropdown, delete |
| 3 | Fișiere | Upload (max 10MB), download, delete |
| 4 | Activitate | Automatikus napló minden változásról |
| 5 | **În Atenție** | Kritikus figyelmeztetők — piros badge ha aktív, resolve + delete |

**"În Atenție" fül működése:**
- Piros pulzáló badge a fül fejlécén, ha van aktív (nem megoldott) alert
- Textarea + gomb — új alert felvétele (Enter is működik)
- Aktív alertek — piros keret, hover-re "Rezolvat" gomb + törlés
- Megoldott alertek — halvány, áthúzva, ki/mikor oldotta meg
- Activity log-ba is bekerül: `alert_added`, `alert_resolved`

---

## Üzleti szabályok

1. **Blocat status** → kötelező `reason` mező (modal + backend validáció)
2. **Dátum változtatás** → kötelező `reason` mező
3. **Activity log** → minden változás automatikusan naplózódik
4. **Recurring tasks** → befejezéskor automatikusan létrehozza a következőt (subtask-ok is másolódnak)
5. **Email emlékeztetők** → 3 fázis: lejárt, utolsó 7 nap, heti (csak munkanapok, 07:00 Bukarest)
6. **"În Atenție"** → task-onkénti kritikus figyelmeztetők, megoldottnak jelölhetők

---

## Environment változók (Railway)

| Változó | Érték |
|---------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `visoro-etm-jwt-secret-2024-prod` ⚠️ cserélendő! |
| `DEV_AUTH_BYPASS` | `true` ⚠️ false-ra állítandó prod-ban! |
| `PORT` | `8080` |

---

## Lokális fejlesztés

```bash
# 1. PostgreSQL indítása
docker compose up -d

# 2. Backend
cd server && npm run dev   # http://localhost:3001

# 3. Frontend (külön terminálban)
cd client && npm run dev   # http://localhost:5173

# 4. Migráció futtatása (ha új migration van)
cd server && npx tsx src/database/migrate.ts
```

**Fontos:** Ha a Docker nem fut, a backend ECONNREFUSED hibával nem indul.  
Az "În Atenție" fül csak task megnyitásakor látható (a TaskDrawer-ben).

---

## Roadmap — Prioritás szerint

### 🔴 AZONNALI (security)
1. Microsoft Entra ID bekapcsolása (`DEV_AUTH_BYPASS=false`)
2. JWT secret cseréje erős random értékre
3. CORS: Railway domain beállítása `CLIENT_URL`-ként

### 🟠 Következő lépések
4. Email küldés — Microsoft Graph API implementálása (TODO komment helyére)
5. In-app értesítések — @mention, subtask assign (migration 012: `notifications` tábla)
6. Task assignee — fő task-hoz is rendelhető user
7. Prioritás mező — `low/normal/high/critical`
8. Admin panel (`/admin`) — user/role kezelés

### 🟡 Hamarosan
9. Kanban nézet (lista + toggle)
10. Bulk actions — tömeges státusz-változtatás
11. Export — CSV/Excel
12. Mobil responsivitás (drawer full-screen, bottom nav)

### 🟢 Hosszú táv
13. React Query / SWR — cache + auto refetch
14. CI/CD (GitHub Actions → Railway auto-deploy)
15. Staging környezet (`develop` branch)
16. Custom domain: `etm.visoro.ro`
17. Full-text search (PostgreSQL `tsvector`)
18. Soft delete tasks

---

## Fejlesztési napló

### 2026-03-10 — Projekt létrehozás + első deploy
**Conversation:** `5ea05c13-c273-431a-a7e0-8798a52537d4`
- ✅ Teljes backend + frontend (001-010 migrációk, seed, 4 route fájl)
- ✅ GitHub push + Railway konfiguráció
- 🐛 Nixpacks → Dockerfile, TS1484 → verbatimModuleSyntax:false, Migration crash → teljes src másolás

### 2026-03-12 — "În Atenție" fül
**Conversation:** `a013b8d3-77b2-461b-a7fb-208299d42541`
- ✅ Migration 011: `task_alerts` tábla
- ✅ Backend alerts CRUD route-ok (GET/POST/PUT resolve/DELETE)
- ✅ Frontend: `TaskAlert` type, `alertsApi`, TaskDrawer 5. fül
- ✅ Git push: commit `a8e127f`

---

*Utolsó frissítés: 2026-03-13*
