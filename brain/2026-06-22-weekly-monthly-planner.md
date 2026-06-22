# 2026-06-22 — Heti/havi tervező + a heti nézet és havi riport leváltása

**Tags:** planner, tasks, multitenancy, cron, i18n, dayview, reports, access-control, workflow
**Commit:** 23be23e (feature) + e57e68f (felfedezhetőségi javítás) · PRP: PRPs/004-weekly-monthly-planner.md
**Related:** [[2026-06-05-open-day-week-monthly-views]] (a most leváltott nézetek), [[2026-06-04-monthly-report-load-failed]] (a most törölt havi riport), [[2026-06-08-ux-notifications-dashboard]] (renderTaskRow/InlineStatusPill minta)

## Mit kért

Robert: legyen **heti terv** és **havi terv** — a felhasználó a meglévő feladatokból
**bejelöléssel** kiválasztja, mit csinál ezen a héten/hónapban, függetlenül a határidőtől.
Majd kiterjesztette: a régi **heti nézet** és **havi riport** kerüljön ki, a tervező lépjen
a helyükre (a **napi nézet marad**). Végül: „csinálj egy komplex csapatot és vidd végig"
→ a teljes implementáció **Workflow-val** (9 agent), és **push egyenesen main-re** (éles).

## Mit változott

Új alrendszer:
- [server/src/database/migrations/094_create_planned_tasks.sql](server/src/database/migrations/094_create_planned_tasks.sql) — `planned_tasks` tábla: id, task_id (FK CASCADE), user_id (FK CASCADE), company_id (FK), scope ('week'|'month'), period_start (DATE), **rolled_over** (BOOL), created_at; UNIQUE(user_id, task_id, scope, period_start).
- [server/src/routes/planner.ts](server/src/routes/planner.ts) — 9 végpont (GET/POST/DELETE week+month, GET company/week+month, GET can-view-company), végig `company_id = req.activeCompanyId` szűrt.
- [server/src/cron/plannerRollover.ts](server/src/cron/plannerRollover.ts) — napi 02:00 (Europe/Bucharest), `withCronLock` (lockKey 91003); hétfőn heti, 1-jén közvetlen havi átgörgetés (status != 'terminat', nem törölt), `rolled_over = true`.
- [client/src/components/planner/PlannerPage.tsx](client/src/components/planner/PlannerPage.tsx) — Heti/Havi fül, periódus-navigáció, „Céges áttekintés" kapcsoló (csak whitelistnek), rolled_over badge.
- [client/src/components/tasks/TaskListPage.tsx](client/src/components/tasks/TaskListPage.tsx) — bulk-action sávban „Tervbe" gomb (heti/havi). Plusz `plannerApi` (api.ts), planner típusok (client+server types), `/planner` route (App.tsx), „Tervező" menüpont (Layout.tsx, mindkét sablon-ág), i18n RO+HU (`planner.*`).

Eltávolítva:
- `client/src/components/dayview/WeekViewPage.tsx` (törölve); `App.tsx`: `/week-view` → `<Navigate to="/planner">`.
- `client/src/components/dashboard/ReportModal.tsx` + `server/src/routes/reports.ts` (törölve); DashboardPage „Raport lunar" gomb + app.ts bekötés ki; `dayView.ts` `/week` végpont ki (a napi `/` és `/pdf` marad).

## Miért — döntések

1. **A terv külön réteg, sosem írja a `due_date`-et.** A `planned_tasks` külön tábla; a betervezés csak egy személyes megjelölés. (Robert választása a 2 közül.)
2. **Heti → havi automatikus, a havi SZÁMOLT (nem duplikált).** A `/month` az unió: `scope='month'` az adott hónapra + `scope='week'` aminek `period_start` hónapja az adott hónap. Egy heti behúzás külön havi sor nélkül megjelenik a haviban. (Robert: „a heti az első, abból a havi; egyelőre gradiensenként" — a fordított irány OUT OF SCOPE.)
3. **Behúzható kör:** assigned_to = user VAGY a usernek van **subtaskja** (a valós `subtasks.assigned_to`, nem kellett created_by fallback). A POST szerveroldalon validál (`resolvePlannableTaskIds`), idegen/más-cég id-t csendben eldob.
4. **Céges áttekintő = USER-WHITELIST, nem szerep.** `COMPANY_PLAN_VIEWER_IDS` 3 id: Emőke (12c31954…), Robert (e2be1cdd…), Mária VASZI (da0fb403…). Más admin NEM látja → 403. A `/can-view-company` mondja meg a frontendnek, mutassa-e a kapcsolót.
5. **Átgörgetés csak heti** (+ közvetlen havi a hónap fordulóján). A heti tételek úgyis számoltan a haviban vannak.
6. **A napi nézet MARAD; a heti nézet + havi riport KI.** A `/week-view` redirect (könyvjelzők nem törnek). A havi riport ≠ a lezárási **completion report** e-mail (`taskCompletionReportService` + `serverI18n` `report.*`) — az MÁS rendszer, érintetlen.

## Gotcha jövő-Claude-nak

- **A havi terv számolt, nincs `scope='month'` sor a heti tételekhez.** Ha valaha „havi az első" kell (a tervezett fordított irány), az ÚJ adatmodell-döntés — ne a meglévőt feszítsd.
- **`rolled_over` oszlop:** a cron állítja `true`-ra; a kézi behúzás DEFAULT false. A badge ezt mutatja. A POST-ok NEM állítják (ON CONFLICT DO NOTHING → egy már kézzel behúzott tétel nem lesz utólag „rolled").
- **Hét kezdete = hétfő, kliens-oldalon `(getDay()+6)%7`** a TaskListPage-ben ÉS a PlannerPage-ben (egyezniük KELL); a cron `Europe/Bucharest` tz-ben számol — normál (romániai) használatban egyezik. Külföldi böngésző-tz határeset elméleti, nem javítottam.
- **Tenant defense-in-depth, amit én adtam a csapat kódjához:** `resolvePlannableTaskIds` subtask-ágba `AND s.company_id = $2`; a rollover JOIN-okba `AND t.company_id = pt.company_id`. A review szerint nélkülük sem volt exploit (a parent-task guard + no-relocation invariáns fedte), de a tenant a projekt legkeményebb szabálya.
- **Kihagyott review-megjegyzés (LOW):** a céges áttekintő nem ellenőrzi a planner-tulajdonos aktuális cég-tagságát/`is_active`-ját → egy kilépett kolléga a terve átgörgetéséig még látszhat. Kozmetikai; Robertnek jeleztem, ráhagyta.
- **Workflow-val épült** (9 agent: 3 felderítő Explore + 2 impl [server/ ill. client/ szétválasztva, hogy ne ütközzenek] + 1 build-gate + 3 adversarial review). A build-gate visszatérése `null` lett a JSON-ban — a tényleges build-validációt MAGAM futtattam (mindhárom zöld). Tanulság: a workflow build-gate eredményét ne vedd készpénznek, futtasd te is.
- **Élő teszt MÉG HÁTRAVAN (deploy után).** A 094 migráció a Railway deploy-kor fut le először. Robert élesben próbálja: lista → „Tervbe" → Tervező; a „Heti nézet" eltűnt, a Dashboardon nincs riport-gomb; a céges kapcsoló csak a 3 whitelist-usernél. Ha gond van, itt kezdd.
- **Nem commitolt szennyezés** (pre-existing): `server/tsconfig.tsbuildinfo`, `ux-mockup.html`, `.claude/worktrees/` — szándékosan kihagyva a commitból.

## Frissítés — felfedezhetőség (2026-06-22, e57e68f)

A push után Robert élesben NEM találta, hogyan adjon feladatot a tervhez. Ok: a
betervezés a TaskListPage bulk-kijelölésére épült (selectedIds + alul a bulk-bar
"Tervbe" gombja), DE a per-sor kijelölő négyzet EGYIK lista-nézetben sincs renderelve
(sem a személyes flat-list 742–799, sem az org-accordion [OrgDepartmentAccordion /
OrgTaskRowsList], sem a fallback) — a sorra kattintás MINDIG megnyitja a feladatot
(setSelectedTaskId). Így a bulk-bar (és benne a "Tervbe", de a status/assign/delete is)
gyakorlatilag SOHA nem jelenik meg.

Javítás (e57e68f): a betervezés átkerült a **TaskDrawer láblécébe** — két gomb
("Hozzáadás a heti/havi tervhez", `addToPlan(scope)`), ami a MEGNYITOTT feladatot teszi
a tervbe, minden nézetből, egy kattintással. A hét hétfője ugyanazzal a képlettel
(`(getDay()+6)%7`), mint a TaskListPage/PlannerPage. A backend változatlan: csak a saját
(assigned VAGY subtask) feladatot engedi (added=0 → `planner.add_not_allowed` üzenet).
A Tervező üres oldala útmutatót kapott (`planner.empty_hint`, RO+HU).

**Gotcha:** a TaskListPage `selectedIds` / bulk-action infrastruktúra (status, assign,
dept, delete, plan) HOLT a UI-ban — nincs per-sor kijelölő checkbox EGYIK nézetben sem.
Ha valaha tömeges műveletet akarunk, ELŐBB a per-sor kijelölőt kell bekötni mind a 3
lista-nézetbe (personal flat-list, org-accordion, fallback). Addig az ilyen akciók a
drawerből (egyesével) érhetők el.

## Hivatkozások

- Commit: 23be23e (feature) + e57e68f (felfedezhetőségi javítás). PRP: PRPs/004-weekly-monthly-planner.md (Approved 2026-06-22).
- A leváltott nézetek megnyitása: [[2026-06-05-open-day-week-monthly-views]]. A havi riport bug-története: [[2026-06-04-monthly-report-load-failed]].
- Érintett: PLANNING.md §2 + §4.1 (frissítve), TASK.md (Done).
