# 2026-06-24 — Választható Dashboard nézet-módok (Fülek / Kanban / Compact / Focus)

**Tags:** dashboard, ux, views, persistence, i18n, frontend, prp, workflow
**Commit:** 2d14066 · **PRP:** PRPs/005-dashboard-view-modes.md (Approved 2026-06-24)
**Related:** [[2026-06-08-ux-notifications-dashboard]] (a jelenlegi lista: renderTaskRow/InlineStatusPill, flex-div sorok)

## Mit kért

Robert: a Dashboard feladatlistáján a sima felhasználók ("a csajok") **nem görgetnek le**, így
nem látják az alsó feladatokat. Kért egy "csapatot" és 3-4 verziót, hogy lássa a megoldási
irányokat. A mockupok után döntött: **tartsuk meg a mostani nézetet, adjuk hozzá mind a 4 újat,
és a felhasználó válassza ki, melyiket szeretné** — fejenként elmentve, és egyelőre csak a saját
feladatlistára (a vezetői áttekintő érintetlen).

## Mit változott

- **Felderítés:** 4 statikus mockup-verzió **Workflow-val** (4 designer + 1 összefűző agent) →
  `dashboard-viewmodes-mockup.html` (repo gyökér, **untracked, eldobható**, mint az `ux-mockup.html`).
  A böngészőben `open`-nel mutattam meg (a Claude-preview screenshot Robertnél nem látszik).
- **Új komponensek** (`client/src/components/dashboard/`):
  - `ViewModePicker.tsx` — legördülő, 6 mód (`DashboardViewMode` + `DASHBOARD_VIEW_MODES` export).
  - `views/viewHelpers.tsx` — `getUrgency` (getDueDateStatus→overdue/today/soon/normal), `locBits`
    (dept·section·post), `OPEN_STATUS_ORDER` (de_rezolvat/in_realizare/blocat), és a megosztott
    `TaskLine` sor (a régi `renderTaskRow` mintájára, `data-task-row` markerrel).
  - `views/TabsView.tsx` (státusz-fülek számmal), `KanbanView.tsx` (oszlopok belső görgetéssel),
    `CompactView.tsx` (sűrű lista urgency-sorrendben + ragadós összegző + "még N lent" pill),
    `FocusView.tsx` (lejárt+mai+folyamatban rangsorolva + "Restul sarcinilor" lenyitó + stat-strip).
- **`DashboardPage.tsx`:** `viewMode` state (default `'list'`) a régi `showCalendar` helyett;
  persistence a `userPreferencesApi`-val (mount-kor `get()`, váltáskor `save({dashboard_view_mode})`);
  `changeViewMode` + `handleStatusChanged`; `ViewModePicker` a fejlécben (a régi Listă/Calendar
  toggle helyén); a feladatlista mód szerint renderel (`list` → régi `renderTaskSection`; a 4 új →
  a komponensek `myAssignedTasks`-szal; `calendar` → `CalendarView`). A "Create de mine" + vezetői
  szekció **változatlanul** alul (minden nem-calendar módban).
- **i18n** RO+HU (`client/src/i18n/locales/{ro,hu}.json`): `view_tabs/kanban/compact/focus`,
  `view_mode_label`, `tab_all`, `focus_title/subtitle/rest/none`, `urgent_label`, `open_label`,
  `tasks_below`, `summary_hint`, `urgency_overdue/today/soon`. (en RO-fallback, nem kapott.)

## Miért — döntések

1. **Persistence = a meglévő `/user-preferences` (user_preferences JSONB blob).** A PUT
   **merge-patch** (`preferences || $2`, `userPreferences.ts:31`), ezért egy `dashboard_view_mode`
   kulcs mentése **nem törli** a `task_group_order`-t. **NINCS migráció, NINCS szerver-változás** —
   tisztán kliens. A `TaskListPage`/`CompletedTasksPage` ugyanezt a mintát használja. (Robert: fejenként mentve.)
2. **Hatókör = csak a saját feladatlista** (`myAssignedTasks` = "Sarcinile mele"). A "Create de mine"
   és a vezetői "Toate pe utilizator" érintetlen, alul marad. (Robert választása.)
3. **A Listă alapértelmezett** — aki nem nyúl hozzá, annak semmi nem változik. A 4 új opt-in.
4. **Kanban: csak nyitott oszlopok**, nincs "Terminat" (a dashboard query `exclude_status:'terminat'`),
   és **nincs drag-drop** — a státuszt a meglévő `InlineStatusPill` állítja, mint mindenhol.
5. **A nézet-választó legördülő** (nem 6 szegmens) a hely miatt; az `InlineStatusPill`
   kattintás/kívül-kattintás-záró mintáját követi.

## Gotcha jövő-Claude-nak

- **KÉT külön preference-tár van.** A nézet-mód a `user_preferences` blobban él
  (`userPreferencesApi`, `dashboard_view_mode` kulcs). A widget-elrendezés a **másik**:
  `dashboard_preferences` tábla / `dashboardApi.getPreferences()/savePreferences()`. Ne keverd őket.
- **A user_preferences PUT MERGE-patch** — egy kulcs mentése megőrzi a többit. Több helyről írják.
- **A 4 új nézet CSAK a `myAssignedTasks`-ot mutatja** (rám rendelt). A "Create de mine" + overseer
  minden nem-calendar módban **alul** renderel, változatlanul. A Kanban tehát NEM "minden feladat".
- **`viewHelpers.tsx` react-refresh ESLint warning** (mixed export: TaskLine komponens + helper
  függvények) **tudatos** — warning, nem error. A `ViewModePicker` is (const+type export). A build a kapu.
- **DashboardPage pre-existing eslint debt** (`getDueDateStatus`/`ChevronDown`/`charts` unused, `any`,
  üres `catch {}`) ÉRINTETLEN — nem az enyém. A `List` ikon-importot viszont kivettem (a régi toggle-lel
  együtt megszűnt a használata). `tsc -b` + `vite build` zöld.
- **CompactView "még N lent" pill:** `window` scroll/resize-listener + `getBoundingClientRect` méri a
  `[data-task-row]` sorokat a hajtás alatt. Fixed pozíció. Ha a layout scroll-konténere változik, ezt
  újra kell nézni.
- **A nézetek a Workflow-mockupból (`dashboard-viewmodes-mockup.html`) lettek Tailwind+React-re portolva.**
  A mockup untracked maradt; ha kell a vizuális spec, ott van.
- **Élő teszt deploy után (Railway):** fejléc → "Vizualizare" legördülő → mód-váltás; F5 után a választott
  mód megmarad (fejenként); a soron státusz-állítás; sorra kattintás → feladat-panel; a stat-kártyák +
  "În Atenție" minden módban fent.

## Hivatkozások

- Commit: 2d14066. PRP: PRPs/005-dashboard-view-modes.md.
- A jelenlegi lista + InlineStatusPill: [[2026-06-08-ux-notifications-dashboard]].
- Persistence-minta: `client/src/components/tasks/TaskListPage.tsx` (`userPreferencesApi`, `task_group_order`).
- Mockup (untracked): `dashboard-viewmodes-mockup.html`.
