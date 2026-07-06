# 2026-07-06 — Rekurens effektív esedékesség + "Depășite" drill-down

**Tags:** tasks, recurring, dashboard, overdue, holidays, i18n, frontend, backend
**Commit:** 6c49360
**Related:** PRPs/006-recurring-effective-due-date.md, TASK.md (Active), brain 2026-06-24-dashboard-view-modes

## Mit kért
Robert három, egymással összefüggő dolgot kért ugyanabban a session-ben:
1. Rekurens (napi/heti/havi/évi) taskoknál, ha az első esedékesség lejárt, ne
   "depășit"-et mutasson a régi dátummal, hanem a **következő** esedékes dátumot.
2. Az ünnepnapokat is vegyük figyelembe a munkanap-igazításnál ("tedd be a
   hivatalos ünnepeket").
3. A Dashboard "Depășite" kártyára kattintva ne a `/tasks` oldalra vigyen (ahol
   a full sablon szervezeti-fa nézetében kézzel kell keresni), hanem **azonnal**
   adja ki a lejártak listáját, **felelős (személy) szerint csoportosítva**.
4. A tovább­görgetett rekurens feladatok **ne** számítsanak lejártnak (se a "30"
   számban, se a listában).

## Mit változott
- **Effektív esedékesség (csak megjelenítés):**
  `client/src/utils/helpers.ts` — új `getEffectiveDueDate(task)`: aktív rekurens
  + lejárt task esetén a gyakorisággal előre görget a legközelebbi jövőbeli
  előfordulásra, `workdays_only`-nál munkanapra igazít (hétvége + `company_holidays`).
  `setHolidays()` modul-szintű állapot (mint a meglévő `setDateLocale`). A tárolt
  `due_date` és a lezárás-alapú továbbgörgetés érintetlen.
- **Ünnepnapok:** új `GET /api/settings/holidays` (`server/src/routes/settings.ts`);
  `Layout.tsx` cégváltáskor betölti; `recurring_workdays_only` mező exponálva
  (`tasks.ts` list + `taskService.ts` detail SELECT, `types/index.ts`, `api.ts`).
- **Badge-helyek effektív dátumra** (8 hely): TaskDrawer, TaskListPage,
  DashboardPage, viewHelpers(getUrgency+TaskLine), FocusView, KanbanView,
  OrgTaskRowsList, ProjectTasksSection. A 3 dátum-helper nullable paramétert kapott.
- **"Depășite" drill-down:** új `client/src/components/dashboard/OverdueTasksModal.tsx`
  (felugró, `tasksApi.list({period:'overdue'})`, felelős szerint csoportosítva,
  taskra kattintva a drawer nyílik). `DashboardPage.tsx`: a Depășite kártya
  `onClick` most `setShowOverdue(true)` (a másik két kártya változatlan). Új
  i18n kulcsok RO+HU (`overdue_modal_title/hint/empty`; EN RO-ra fallbackel).
- **Lejárt = effektív alapú (backend):** aktív rekurens taskok kizárva a lejárt
  számításokból — `dashboard.ts` `/stats` "30" + `/my-stats` `my_overdue`, és
  `tasks.ts` `period=overdue` szűrő (ez táplálja a felugrót és a listát).

## Miért — döntések
- **Miért csak megjelenítés (nem cron/auto-advance)?** Simplicity §3 + Robert
  szava ("mutassa"). A lezárás-alapú modell (lezáráskor új task jön létre a
  `next_run_date`-tel) érintetlen marad; nincs adatmodell-átalakítás, nincs cron.
- **Miért DB-ből az ünnepnapok, nem hardkód?** A `company_holidays` a forrás
  (083 migráció, HU/RO 2026–2027 + admin bővíthet). Hardkód elavulna és a
  cég-egyedi ünnepeket kihagyná. A frontend ugyanazt a naptárt kéri le.
- **Miért felugró és nem szűrt lista?** Robert választotta (AskUserQuestion):
  "Felugró a Dashboardon" + "Csak Depășite". Az "azonnal"-nak ez felel meg.
- **Miért NEM lejárt egy rekurens task?** Egy aktív rekurens task effektív
  dátuma mindig >= ma → sosem késik, csak újra esedékes. Ezért a backend
  kizárás egyszerű: `NOT EXISTS (aktív recurring_tasks szabály)`.
- **Szándékosan érintetlen:** superadmin cégek-közti `admin.ts` overdue, és a
  **külső API** (`/api/v1`, externalApi.ts) — utóbbi integrációs szerződés, nem
  akartuk csendben megváltoztatni a "lejárt" jelentését.

## Gotcha jövő-Claude-nak
- **`period=overdue` + COUNT:** a `tasks.ts` lista lapozásához külön
  `SELECT COUNT(*) FROM tasks t ${whereClause}` fut, ami **NEM** tartalmazza a
  `LEFT JOIN recurring_tasks rt`-t. Ezért a rekurens-kizárást **önálló
  `NOT EXISTS` al-lekérdezéssel** kell írni (alias `rt_ov`), nem a fő query
  `rt` join-jára hivatkozva — különben a COUNT elszáll. (`$1` = active company id
  mindkét query-ben.)
- **`workdays_only` csak "napi"?** NEM garantált. A UI (TaskFormModal/Drawer)
  csak napinál kínálja, de a `TaskFormModal` beküldéskor feltétel nélkül elküldi
  a `workdaysOnly` state-et (napi→heti váltás után is), és a szerver bármely
  gyakoriságnál alkalmazza. Ezért `getEffectiveDueDate` **általánosan** kezeli.
  (Meglévő apró inkonzisztencia a TaskFormModal-ban — nem javítottuk.)
- **Ünnepnapok betöltése nem-reaktív:** `setHolidays` modul-szintű, nem trigger-el
  re-rendert (mint `setDateLocale`). Első paint munkanap-igazítást csak hétvégére
  végezhet, míg az ünnepnapok betöltődnek. A gyakorlatban a Layout korán fetch-el;
  csak napi+workdays_only+ünnep-szomszéd esetben számít, ritka.
- **Effektív dátum vs. valós rendezés:** a lista backend `ORDER BY t.due_date` a
  VALÓS dátum szerint marad — egy rolled rekurens task a tetején lehet, jövőbeli
  dátummal. Tudatosan hatókörön kívül.

## Frissítés (ugyanaznap, commit 05945a3) — blocat ne legyen "lejárt"
Robert: egy blocat (blokkolt) task ne jelenjen meg "depășit"-ként, a dátum
tűnjön el — mert a határidő "áll", és zavaró. Ugyanaz a minta, mint a rekurens-
kizárásé:
- **Backend:** blocat kizárva a "Depășite" számból (`/stats`, `/my-stats`:
  `status NOT IN ('terminat','blocat')`) és a `period=overdue` szűrőből (→ a
  felugró listából is). Indok: külön "Blocate" kártya van, dupla számolás lenne.
- **Frontend:** a listákban/dashboardon a blocat taskoknál eltűnik a dátum és a
  sürgősségi szín (getUrgency + a 8 badge-hely `task.status !== 'blocat'` gate).
- **Drawer:** a dátum-pilula MEGMARAD (az a szerkesztő gomb), de semleges —
  `dueStat = (status !== 'terminat' && status !== 'blocat') ? ... : 'normal'`.
  Döntés: a szerkesztő kontrollt nem rejtjük el, csak a "depășit" megjelenést.

## Hivatkozások
- PRPs/006-recurring-effective-due-date.md (a részletes terv + validáció)
- 083_company_holidays.sql (ünnepnap-tábla + seed)
- tasks.ts:~505-620 (lezárás-alapú rekurencia-továbbgörgetés — a modell)
- brain 2026-06-24-dashboard-view-modes (a dashboard nézet-módok, ahova a badge-ek tartoznak)
