# PRP: Rekurens taskok — esedékesség-badge a következő dátumra görget

## Goal
Egy aktív rekurens task (napi/heti/kétheti/havi/negyedéves/évi), amelynek az
esedékessége már lejárt, ne "depășit"-ként (piros, "eredeti dátum + depășit Nz")
jelenjen meg, hanem a **következő esedékes rekurens dátumot** mutassa a badge-en,
normál/soon színnel. A cél: a rekurens rutinfeladatok ne "késésként" nyaggassanak,
hanem azt mutassák, mikor esedékesek legközelebb. Ez **csak megjelenítés** — a
tárolt `due_date`, a lezárás-alapú továbbgörgetés és az adatbázis változatlan.

## Context
- Files to read:
  - `client/src/utils/helpers.ts` — `getDueDateStatus` / `getDaysOverdue` / `getDaysUntil`
  - `client/src/components/tasks/TaskDrawer.tsx:313,463-464` — a képernyőképen látott dátum-pilula
  - `client/src/components/tasks/TaskListPage.tsx:743-745`
  - `client/src/components/tasks/OrgTaskRowsList.tsx:57`
  - `client/src/components/projects/ProjectTasksSection.tsx:60`
  - `client/src/components/dashboard/DashboardPage.tsx:238-239`
  - `client/src/components/dashboard/views/viewHelpers.tsx` — `getUrgency`
  - `server/src/routes/tasks.ts:545-566` — a backend rekurencia-léptetés (referencia a frekvencia-matekhoz)
- Existing patterns: a `Task` típus már tartalmazza `is_recurring` és
  `recurring_frequency` mezőket, a szerver már küldi őket (tasks.ts:225-226).
- Known gotchas:
  - `workdays_only` (munkanapra igazítás) a szerveren a cég-ünnepnapokból számol;
    a frontend ezt nem ismeri, ezért a kijelzett következő dátum ±pár nap eltérhet a
    tényleges (lezáráskor létrejövő) task dátumától, ha munkanap-igazítás van. Ez
    csak becslés a badge-en — elfogadható. (Megjegyzés a jelentésben.)
  - A backend lista `ORDER BY t.due_date` a valós dátum szerint rendez, tehát egy
    rekurens task a lista tetején maradhat, miközben jövőbeli dátumot mutat. Ez
    külön (backend) kérdés, most **nem** része a scope-nak.
  - Naptár-alapú nézetek (DayView) a valós `due_date`-re helyezik a taskot —
    ezeket **nem** érintjük, mert ott a dátum a horgony.

## Implementation Plan
1. `helpers.ts`: új tiszta függvény
   `getEffectiveDueDate(task: { due_date; is_recurring?; recurring_frequency?; status? }): string | Date`.
   - Ha nincs `due_date`, vagy nem rekurens, vagy nincs frekvencia, vagy a task
     `terminat` → visszaadja a `due_date`-et változatlanul.
   - Ha a `due_date` ma vagy a jövőben van → változatlanul visszaadja.
   - Ha a `due_date` a múltban van → a `due_date`-et a frekvenciával előre görgeti
     (a backend `tasks.ts` switch-jét tükrözve: daily +1 nap, weekly +7, biweekly
     +14, monthly +1 hó, quarterly +3 hó, yearly +1 év), amíg `>= ma` nem lesz, és
     azt adja vissza.
   - Verify: unit-jellegű ellenőrzés kézzel (lásd Validation).
2. A 6 badge-hívási helyen a `task.due_date` helyett `getEffectiveDueDate(task)`
   használata a `getDueDateStatus` / `getDaysOverdue` / `getDaysUntil` /
   `formatDate` hívásokban, ahol a badge-et rajzolják:
   - `TaskDrawer.tsx` (dueStat + a pilula dátuma és a "depășit Nz" suffix)
   - `TaskListPage.tsx` (dueDateStatus/daysOverdue/daysUntil)
   - `OrgTaskRowsList.tsx` (dueDateStatus + megjelenített dátum)
   - `ProjectTasksSection.tsx` (dueStatus + dátum)
   - `DashboardPage.tsx` (daysOverdue/daysUntil)
   - `viewHelpers.tsx` `getUrgency` + a `TaskLine` dátum-formázása
   - Verify: rekurens, lejárt task minden nézetben a következő dátumot mutatja,
     nem pirosat; nem-rekurens task viselkedése változatlan.
3. A `due_date` **szerkesztő** felület (TaskDrawer "Schimbă data" popover) továbbra is
   a **valós** `task.due_date`-tel dolgozik (nem az effektívvel) — a szerkesztés a
   tárolt dátumot állítja. Verify: a "Schimbă" popover a valós dátumot mutatja.

## Validation Loop
- Lint: `cd client && npx eslint` a módosított fájlokra (vagy a projekt lint scriptje).
- Build: `cd client && npx tsc -b` — típushiba-mentes.
- Manuális teszt (Robert, Chrome, éles deploy után):
  1. Nyiss meg egy heti rekurens taskot, aminek a határideje pár napja lejárt
     (mint a "Mukodesi iranyelvek", 3 iul, depășit 3z). A dátum-pilula mostantól a
     **következő heti** dátumot mutatja, normál/borostyán színnel, "depășit" nélkül.
  2. Listában / Dashboardon ugyanaz a task: nem piros, a következő dátum látszik.
  3. Egy **nem**-rekurens lejárt task továbbra is pirosan "depășit Nz"-t mutat.
  4. "Schimbă data" popover a valós (eredeti) dátumot mutatja szerkesztéskor.

## Out of Scope
- Backend/adatbázis/cron változás — semmi.
- A lista rendezése (`ORDER BY due_date`) a valós dátum szerint marad.
- Naptár/napi nézet (DayView) elhelyezési logikája.
- `workdays_only` pontos munkanap-igazítás a frontend becslésben.
- A lezárás-alapú "új task létrehozása" folyamat — érintetlen.
