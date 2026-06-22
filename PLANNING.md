# PLANNING.md

> Ez a fájl a projekt hivatalos állapotát írja le. A first-run interjú
> helyett a meglévő, éles kódbázisból építettük fel (2026-05-29), mert az
> ETM már érett, production rendszer — a "ground truth" maga a futó kód.
> A korábbi `PROJECT.md` elavult (2026-03-24, multi-tenancy/i18n/PUG előtt) —
> ez a fájl váltja le.

## 1. Projekt
- **Név:** Visoro Task Manager (ETM)
- **Tulajdonos:** Robert Ledenyi / Visoro Global SRL
- **Indítva:** 2026-03-10 (első deploy). Multi-tenant újraépítés: 2026-05 (070+ migrációk).
- **Státusz:** Aktív fejlesztés, éles használatban (production).
- **Repo:** github.com/VisoroGroup/ETM
- **Deploy:** etm-production-62a7.up.railway.app — Railway, **auto-deploy `main` push-ra** (nincs külön staging).

## 2. Cél

Az ETM a Visoro Global belső feladat- és projektmenedzsment webalkalmazása.
Eredetileg egy egycéges feladatkezelőként indult, mára **multi-tenant**
platform: több Visoro-cég (tenant) használja, mindegyik a saját
`template_type`-jával (`full` / `project` / `simple`), ami eldönti, milyen
nézetek és alrendszerek érhetők el. A felhasználók Microsoft Entra-val vagy
magic-linkkel jelentkeznek be, és feladatokat kezelnek (subtask, komment,
csatolmány, "În Atenție" figyelmeztetés, függőség, ismétlődés). A
`project`-template cégeknél fut a **PUG (Projekt Ügymenet)** alrendszer:
többlépcsős projektek (Talajradar/David-GPR flow) szakasz-státuszokkal,
egyéni mezőkkel, projekt-csatolmányokkal és publikus megosztó linkekkel.
A felhasználók kézi **heti/havi tervet** (Planificare) is összeállíthatnak a meglévő
feladatokból (bejelöléssel, a határidőt nem érintve; a heti tételek automatikusan a
haviba számítanak, a be-nem-fejezettek hetente átgörögnek). Egy szűk vezetői kör
(user-whitelist) céges összesítőt is lát. Ezzel a korábbi határidő-alapú **heti nézet**
és a **havi riport** megszűnt (a `/week-view` a tervezőre irányít); a **napi nézet**
megmaradt. A felület többnyelvű (RO a teljes master, HU és EN), alapnyelv a román.

**Nem része:**
- **Payments / Financiar modul** — eltávolítva. A 2026-03 verzióban még
  létezett (route + dashboard), mára sem route, sem komponens nincs hozzá.
- **Publikus önregisztráció** — a hozzáférés cég-tagság (`user_companies`)
  vagy magic-link alapú; nincs nyílt sign-up.
- **Külön staging környezet** — a `main` push közvetlenül élesre telepít.

## 3. Sikerkritériumok / invariánsok
- **Tenant-izoláció:** minden tenant-scoped lekérdezés `company_id`-re szűr;
  egy user csak a saját cégei adatát látja. Nincs cross-tenant szivárgás.
- **Auth:** a Microsoft Entra ÉS a magic-link belépés is működik.
- **i18n:** hiányzó kulcs RO-ra fallbackel, nem dob hibát.
- **Deploy:** `main` push után a Railway build (`tsc -b && vite build`)
  zölden lefut és élesre megy.
- **Tesztelhetőség:** Robert élesben (Chrome) le tudja tesztelni a változást.

## 4. Architektúra

### 4.1 Komponensek
| Komponens | Felelősség | Technológia |
|-----------|-----------|-------------|
| Frontend SPA | UI, routing, állapot, lazy-loaded oldalak | React 19 + TS + Tailwind v4 (Vite), React Router 7, TanStack Query |
| Backend API | REST API, auth, üzleti logika, tenant-scoping | Express 4 + TS, `pg` |
| Adatbázis | Perzisztencia (multi-tenant); fájlok és avatárok `bytea`-ban | PostgreSQL 15 (Railway managed), 094 migráció |
| Auth | Bejelentkezés + cég-kontextus | Microsoft Entra (MSAL) + magic-link, JWT (HS256) |
| Email | Értesítések + napi összefoglaló | Microsoft Graph API (Mail.Send) |
| Cron | Ütemezett job-ok (napi email, PUG emlékeztetők, heti/havi terv-átgörgetés) | node-cron + DB-alapú distributed lock (multi-replica Railway) |
| MCP szerver | AI-asszisztens integráció | @modelcontextprotocol/sdk → `/api/v1` |
| Külső REST API | Programozott hozzáférés | `/api/v1`, Bearer token (`apiTokenAuth`) |

### 4.2 Adatáramlás — a multi-tenancy lelke
1. A kliens minden API-híváshoz beállítja az `X-Active-Company` headert
   (axios interceptor, `client/src/services/api.ts`).
2. A szerver (`server/src/middleware/auth.ts`) ebből feloldja a
   `req.activeCompanyId`-t. **Ha a header hiányzik, csendben az első cégre
   esik vissza** (`companyIds[0]`) — ez a leggyakoribb tenant-bug forrása.
3. Minden tenant-scoped query `WHERE company_id = $activeCompanyId`-vel szűr.
4. **Fájlok:** a `<img>`/`<iframe>`/`<a>` nem tud HTTP headert küldeni, ezért
   a fájlokat raw `fetch()`-csel húzzuk le (JWT + **kézzel** rárakott
   `X-Active-Company`), és blob URL-t adunk nekik
   (`client/src/hooks/useAuthedFileUrl.tsx`).

## 5. Tech stack
- **Nyelvek:** TypeScript (kliens + szerver), SQL (migrációk).
- **Frontend:** React 19, Vite 6, Tailwind CSS v4, React Router 7,
  TanStack React Query 5, axios, date-fns, zod, lucide-react, DOMPurify,
  @hello-pangea/dnd, react-big-calendar, @sentry/react.
- **Backend:** Express 4, `pg`, jsonwebtoken, node-cron, multer, pdfkit,
  exceljs/xlsx, zod, @azure/msal-node + @microsoft/microsoft-graph-client,
  express-rate-limit, @sentry/node.
- **Adatbázis:** PostgreSQL 15 (Railway managed), SSL prod-ban.
- **Hosting / futtatás:** Railway, Dockerfile (multi-stage node:20-alpine),
  a backend prod-ban a frontend statikus build-jét is kiszolgálja.
- **AI integráció:** MCP szerver (`server/mcp/`) + külső `/api/v1` REST API.

## 6. Stílus és konvenciók
- **Linter:** ESLint (kliens és szerver külön).
- **Type-check / build:** `tsc -b` (project references, strict mode);
  prod build: `tsc -b && vite build`. **A build szigorúbb, mint a
  `tsc --noEmit`** — lásd brain `2026-05-...` (a narrow-window bug).
- **i18n:** RO a master; HU és EN. Új kulcs lehetőleg minden locale-ba
  kerüljön, de hiány esetén RO-ra fallbackel (`I18nContext.tsx`).
- **Multi-tenancy:** minden tenant-scoped query `company_id`-re szűr; minden
  raw `fetch()` kézzel teszi rá az `X-Active-Company` headert.
- **Route-szervezés:** domain-enként külön route fájl (`server/src/routes/`).
- **Naming:** camelCase TS-ben; a meglévő mintákat követjük (CLAUDE.md 4. §).

## 7. Korlátok
### 7.1 Kemény (nem sérthetők meg)
- **Nincs cross-tenant adatszivárgás** — minden tenant-scoped lekérdezésnek
  `company_id` szűrőt KELL tartalmaznia.
- **`DEV_AUTH_BYPASS` sosem lehet aktív production-ben.**
- **`JWT_SECRET` kötelező env** production-ben.
- **Fájlok Postgres `bytea`-ban**, NEM lemezen (a Railway ephemeral storage
  miatt — deploy után a lemez tartalma elveszne).
- **Új dependency / nyelv-verzió / build-rendszer csak Robert engedélyével**
  (CLAUDE.md 9.3 §).

### 7.2 Puha (preferenciák)
- RO az interfész alapnyelve; HU/EN fallback RO-ra.
- Robert Chrome-ban tesztel élesben (nincs staging) — nagy hatókörű
  változásnál óvatosság, mert a `main` push azonnal éles.
- Robert nem programozó — minden magyarázat közérthető magyarul (CLAUDE.md 10. §).

## 8. Eldöntött kérdések (2026-05-29, Robert)
- **Payments/Financiar modul:** véglegesen eltávolítva (megerősítve). Nem tér
  vissza; ha valaha mégis kell, az új feature lesz, nem a régi visszahozása.
- **PROJECT.md:** megtartva történeti rekordként, a tetején "ELAVULT" sávval.
  A `PLANNING.md` a hivatalos, aktuális forrás.
- **EN locale:** az angol **nem támogatott nyelv** (jelenleg 93/1001 string,
  kb. 9% — a felület 91%-a románra esne vissza). Senki nem használja, ezért
  **kivesszük a választható nyelvek közül**, nem fordítjuk le teljesen. Az
  implementáció külön task (lásd `TASK.md`).

## 9. Hivatkozások
- **Külső:** github.com/VisoroGroup/ETM · etm-production-62a7.up.railway.app
- **Belső:** `PROJECT.md` (elavult, 2026-03 — történeti) · `brain/INDEX.md`
  (session-emlékezet) · `AGENTS.md` (first-run protokoll) · `CLAUDE.md`
  (operating rules).

---
*Utoljára frissítve: 2026-06-22 — heti/havi tervező (PRP 004), a heti nézet + havi riport
leváltása. Korábban: 2026-05-29 — felépítve a meglévő kódbázisból (nem interjúval).*
