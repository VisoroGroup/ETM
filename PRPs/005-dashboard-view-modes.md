# PRP: Dashboard nézet-módok (választható, fejenként mentett)

**Státusz:** Done — implementálva és build-validálva. Élő teszt deploy után.
**Indítva:** 2026-06-24 · **Jóváhagyva:** 2026-06-24 (Robert)
**Kérte:** Robert
**Kapcsolódó:** PRPs/002-ux-calm-dashboard-and-notifications.md (a jelenlegi lista),
brain `2026-06-08-ux-notifications-dashboard`, `dashboard-viewmodes-mockup.html` (vizuális spec)

## Goal

A Dashboard jelenlegi feladatlistája ("Sarcinile mele", státusz-csoportos lista) **megmarad
alapértelmezettnek**, és mellé négy választható nézet-mód kerül: **Fülek, Kanban, Compact,
Focus**. A meglévő **Listă** és **Calendar** is választható marad. A felhasználó a Dashboard
tetején vált; a választása **fejenként, adatbázisban elmentve** marad (a meglévő
`user_preferences` JSON-blobban). Cél: a "nem görgetnek le, nem látják az összes feladatot"
probléma megoldása anélkül, hogy bárkinek a megszokott nézete megváltozna.

**Hatókör (Robert döntése 2026-06-24):** a nézet-választó a felhasználó **saját feladatlistáját**
("Sarcinile mele" = nekem kiosztott) érinti. A vezetői "Toate pe utilizator" áttekintő
**változatlan**.

## Context

### Files to read
- `client/src/components/dashboard/DashboardPage.tsx` — a fő fájl: jelenlegi lista (`renderTaskRow`,
  `renderTaskSection`), Listă/Calendar toggle (`showCalendar`), stat cards, "În Atenție", overseer szekció.
- `client/src/components/dashboard/CalendarView.tsx` — a Calendar mód (lazy).
- `client/src/components/tasks/InlineStatusPill.tsx` — soron belüli státusz-állító (props: `taskId`,
  `currentStatus`, `onChanged`). Az új nézetek ezt használják.
- `client/src/components/tasks/TaskListPage.tsx` (sorok 76, 101) — **minta a persistence-re**:
  `userPreferencesApi.get()` mount-kor, `userPreferencesApi.save({ kulcs: érték })` váltáskor.
- `client/src/services/api.ts` — `userPreferencesApi.get/save`, `dashboardApi`, `tasksApi`.
- `client/src/types/index.ts` — `Task`, `TaskStatus`, `STATUSES` (label+color), `DEPARTMENTS`.
- `client/src/utils/helpers.ts` — `getDueDateStatus` ('overdue'|'today'|'tomorrow'|'soon'|'normal'),
  `getDaysOverdue`, `getDaysUntil`, `formatDate`.
- `client/src/i18n/locales/ro.json`, `hu.json` — új kulcsok.
- `dashboard-viewmodes-mockup.html` (repo gyökér) — a 4 nézet **vizuális specifikációja**.

### Existing patterns to follow
- **Persistence:** `userPreferencesApi` merge-patch (a szerver `preferences || $2`-vel fésül,
  `userPreferences.ts:31`). A `TaskListPage` pontosan ezt csinálja a `task_group_order`-rel.
- **Sor + státusz + megnyitás:** `renderTaskRow` mintája — flex `<div>` sor, `InlineStatusPill`
  `stopPropagation`-nel, a sorra kattintás `setSelectedTaskId(id)` (TaskDrawer).
- **Téma:** navy paletta, flex/grid (NEM `<table>`), a 2026-06-08 UX-kör mintái.

### Known gotchas
- A Dashboard sorai **flex `<div>`-ek, nem `<table>`** (brain 2026-06-08). Az új nézetek is flex/grid.
- A dashboard task-lekérdezés **kizárja a `terminat`-ot** (`exclude_status:'terminat'`), ezért a
  Kanbanban **nincs valódi "Terminat" oszlop** (a mockupé illusztratív volt). v1: csak a nyitott
  oszlopok (De rezolvat / În realizare / Blocate).
- `collapsedStatuses` 3 szintű kulcsokat kever (`sect_*`, `<key>_<status>`, `user_*`) — az új
  nézetek ezt **nem** használják, saját belső állapotuk van.
- A persistence merge-patch → `save({dashboard_view_mode})` **nem törli** a `task_group_order`-t.
  **Nincs migráció, nincs szerver-változás** — tisztán kliens.
- Élő, nem-admin teszt korlát: az MS365 SSO superadminként léptet be (brain). A módváltás így is
  tesztelhető; az overseer-szekció érintetlen.

## Implementation Plan

1. **State + persistence a DashboardPage-ben.**
   - Új state: `viewMode: 'list' | 'tabs' | 'kanban' | 'compact' | 'focus' | 'calendar'`, default `'list'`.
   - Mount-kor `userPreferencesApi.get()` → ha a `dashboard_view_mode` érvényes érték, állítsd be
     (különben `'list'`). (A `dashboardApi.getPreferences()` widget-layout külön marad.)
   - `setViewMode(m)` → state + `userPreferencesApi.save({ dashboard_view_mode: m }).catch(()=>{})`
     (tűzd-és-felejtsd).
   - A `showCalendar` boolean megszűnik; `viewMode === 'calendar'` váltja.
   - **Verify:** a választott mód reload (F5) után megmarad.

2. **Nézet-választó UI a fejlécben.**
   - A jelenlegi Listă/Calendar 2-gombos toggle helyére egy kompakt **dropdown** ("Vizualizare:
     [ikon] <aktuális> ▾"), ami a 6 módot kínálja (a hely miatt dropdown, nem 6 szegmens).
   - i18n: `dashboard.view_tabs`, `dashboard.view_kanban`, `dashboard.view_compact`,
     `dashboard.view_focus` (a `view_list` / `view_calendar` megvan).
   - **Verify:** minden mód kiválasztható, az aktív kiemelve.

3. **Négy új nézet-komponens** `client/src/components/dashboard/views/` alatt:
   `TabsView.tsx`, `KanbanView.tsx`, `CompactView.tsx`, `FocusView.tsx`.
   - Közös props: `{ tasks: Task[]; onOpenTask: (id: string) => void;
     onStatusChanged: (id: string, s: TaskStatus) => void; isFullTemplate: boolean }`.
   - `tasks` = `myAssignedTasks` (a "Sarcinile mele").
   - Minden sor/kártya: cím + (full template) halvány "részleg · poszt" + dátum (piros/amber
     overdue/soon a `getDaysOverdue`/`getDaysUntil`/`getDueDateStatus` alapján) + `InlineStatusPill`
     (státusz-állítás) + kattintás → `onOpenTask` (TaskDrawer).
   - Logika a mockupból portolva: **Fülek** (státusz-fülek darabszámmal, egyszerre egy lista),
     **Kanban** (státusz-oszlopok belső görgetéssel + darabszám), **Compact** (sűrű lista +
     ragadós összegző sáv + "még N feladat ↓" jelzés), **Focus** (lejárt+mai+folyamatban rangsorolt
     blokk + "Restul sarcinilor (N)" lenyitó).
   - A nézetek **nem** rajzolnak saját stat-stripet (a Dashboard 4 stat-kártyája felül megvan).
   - **Verify:** mindegyik a valós feladatokat mutatja; a státusz-pill állít; a sor nyit.

4. **DashboardPage integráció.**
   - Felül változatlanul: header + új nézet-választó, "În Atenție", stat cards.
   - Középen `viewMode` szerint: `list` → jelenlegi `renderTaskSection(assigned)`;
     `tabs/kanban/compact/focus` → az új komponens (`myAssignedTasks`-szal);
     `calendar` → `CalendarView` (lazy).
   - Alul változatlanul (minden nem-calendar módban): "Create de mine" (collapsed) +
     (admin) "Toate pe utilizator" (collapsed) — **érintetlen**.
   - A `renderTaskRow`/`renderTaskSection` marad a `list` módhoz + a created/overseer szekciókhoz.
   - **Verify:** a Listă mód a maival azonos; az új módok a stat/alerts alatt jelennek meg.

5. **i18n** RO + HU az új kulcsokra (en RO-fallback). Belső címkék: pl. `dashboard.focus_title`
   ("Astăzi & urgent"), `dashboard.focus_rest` ("Restul sarcinilor"), `dashboard.more_below`
   ("încă {n} sarcini"), a fül/oszlop-címkékhez a meglévő `STATUSES` labelek.

## Validation Loop
- `cd client && npx tsc -b && npx vite build` → **zöld** (ez fut élesen).
- Szerver: **nincs változás** (nincs új route/migráció); a biztonság kedvéért `cd server && npx tsc` zöld.
- ESLint a 4 új fájlon + a DashboardPage változott sorain: **0 új hiba** (a pre-existing debt érintetlen).
- **Manuális (Robert, élesben):**
  1. Dashboard → fent a nézet-választó. Váltogasd: Listă (mai) / Fülek / Kanban / Compact / Focus / Calendar.
  2. Mindegyikben a saját feladataid látszanak; a státuszt a soron állítva változik; a sorra
     kattintva nyílik a feladat-panel.
  3. Válassz pl. Kanban-t, frissítsd az oldalt (F5) → Kanban marad (fejenként, DB-ben mentve).
  4. A felső statisztika-kártyák és az "În Atenție" minden módban fent maradnak.

## Out of Scope
- A vezetői "Toate pe utilizator" áttekintő átstílusozása (marad a mai).
- Kanban "Terminat" oszlop / befejezett feladatok (a dashboard nyitott feladatokra szűr).
- **Drag-and-drop** a Kanban oszlopok közt (a státuszt a meglévő `InlineStatusPill` állítja, nem húzással).
- A "Create de mine" és a Calendar nézet átdolgozása (érintetlen).
- Mobil-specifikus mély finomhangolás a reszponzív alapokon túl.
- Bármilyen szerver-/adatbázis-változás (a persistence a meglévő `/user-preferences`-re épül).
