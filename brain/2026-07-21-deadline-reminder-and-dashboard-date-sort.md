# 2026-07-21 — Dashboard dátum-rendezés + határidő-email 5/2/1 (felelősnek is)

**Tags:** dashboard, tasks, cron, email, reminders, frontend, backend, prp
**Commit:** 9603e0a
**Related:** PRPs/011-deadline-reminder-and-dashboard-date-sort.md, [[2026-07-06-recurring-effective-due-and-overdue-drilldown]] (getEffectiveDueDate, dashboard badge-ek), [[2026-06-24-dashboard-view-modes]] (a Listă vs. a többi nézetmód), [[2026-06-22-weekly-monthly-planner]] (cron minta + lock namespace)

## Mit kért
Robert két dolgot: (1) a Dashboardon a feladatok ne **stádium** szerint legyenek
felsorolva, hanem **dátum** szerint (legközelebbi határidő fent, lefelé); (2) legyen
**cronjob**, ami a határidő előtt **5, 2, 1 nappal** emailt küld, hogy a feladat le fog
járni. Plusz explicit kérdés: „nézd meg van-e másik cronjob, ami ezzel egybevág?".

## A kulcs-felfedezés (a „van-e másik cron?" válasza: IGEN)
A `emailScheduler.ts` (napi 07:00, Mon-Fri, lock 91001) **már küldött** határidő-
emlékeztetőt: a `shouldSendReminder` (`utils/dateUtils.ts`) fázisai **4/2/1 munkanappal**
előtte + `due_today` + `overdue` (naponta) + `weekly` (hétfő, ha >7 nap). Tehát Robert
kérése ~a meglévő logika, csak 5 kellett 4 helyett. → **Nem építettem új cront**
(dupla email lett volna); a meglévőt igazítottam. A `pugStageReminders.ts` külön rendszer
(csak `project` sablonú cégek projekt-szakaszai) — nem ütközik.

Két meglepő tény a régi kódban:
- A napi email a **létrehozónak + subtask-felelősöknek** ment — a **fő felelős**
  (`assigned_to`) **kimaradt**, ha nem ő hozta létre. Valószínűleg ezért érezte Robert,
  hogy „nincs értesítés".
- A megjelenített „X nap múlva esedékes" **naptári** napot ír (`{{days}}`), nem a
  munkanap-küszöböt. 5 munkanap ≈ 7 naptári nap → az email „7 nap"-ot mondhat. Pre-existing, marad.

## Mit változott
- **Dashboard** ([client/src/components/dashboard/DashboardPage.tsx](client/src/components/dashboard/DashboardPage.tsx)):
  a `groupByStatus`/`statusOrder` **törölve**; új `sortByDueDate` (effektív dátum szerint
  növekvő, `blocat` + dátum nélküli `Infinity`-vel a lista aljára). `renderTaskSection`
  (Sarcinile mele + Create de mine) és a vezetői per-user blokk mind **sima, dátum-rendezett
  listát** renderel a státusz-alcsoportok helyett. A státusz soronként megmarad
  (bal csík + `InlineStatusPill`). **Csak a Listă nézetmód** — a Fülek/Kanban/Compact/Focus
  eleve stádium-alapú, érintetlen.
- **Email fázis** ([server/src/utils/dateUtils.ts](server/src/utils/dateUtils.ts)):
  `shouldSendReminder` Phase 2: `subtractWorkingDays(dueDate, 4)`→`5`, fázis
  `'4_days_before'`→`'5_days_before'`, doc-komment „4,2,1"→„5,2,1".
- **Email címzett + fázis-fogyasztó** ([server/src/cron/emailScheduler.ts](server/src/cron/emailScheduler.ts)):
  a due_soon ág `phase === '5_days_before'`-t figyel; a címzett-halmaz **additív**:
  `assigned_to` (ha van) **HOZZÁADva** a meglévő `created_by` + subtask-felelős körhöz.
- **Teszt** ([server/src/__tests__/unit/dateUtils.test.ts](server/src/__tests__/unit/dateUtils.test.ts)):
  +2 eset (5 munkanappal előtte → `5_days_before` küld; 4 munkanappal előtte → nem küld).
- **Release** id 9 (RO+HU) + TASK.md Active + PRP 011.

## Miért — döntések
- **Meglévő módosítása, nem új cron** (Robert választása, AskUserQuestion). Nincs dupla
  email, nincs új lock/scheduler.
- **Címzett = additív** (Robert **végső** döntése: „maradjanak bent"). Az AskUserQuestion-ben
  előbb „felelős + létrehozó"-t választott, DE miután felhoztam, hogy az kiejtené a
  subtask-felelősöket a napi digestből (ami nem csak határidőről szól), az additívra
  váltott. Tanulság: az AskUserQuestion opció-szöveg nem mindig fedi a teljes mellékhatást
  — érdemes push előtt még egyszer kimondani a következményt.
- **Rendezés effektív dátum szerint**, nem nyers `due_date` — hogy egyezzen a sor által
  KIÍRT dátummal (rolled rekurens task jövőbeli dátumot mutat; nyers szerint felülre
  kúszna múltbeli dátummal). Lásd [[2026-07-06-recurring-effective-due-and-overdue-drilldown]].
- **Blocat + dátum nélküli a lista aljára** (`Infinity` kulcs): a blocat határideje „áll"
  (a sor a dátumot úgyis elrejti), ne szennyezze a „legközelebbi fent" tetejét. Robertnek
  jeleztem, hogy ha inkább a dátumuknál akarja, egy szó.
- **Munkanap, nem naptári** (a rendszer végig `subtractWorkingDays`-re épül). 5 munkanap = 7
  naptári nap → `diff===7` még belép a Phase 2-be (`diff <= 7`); a `weekly` csak `diff > 7`.

## Gotcha jövő-Claude-nak
- **A `5_days_before` fázis-stringnek EGY előállítója** (`dateUtils.ts`) és **EGY
  fogyasztója** van (`emailScheduler.ts` due_soon ág). Ha módosítod, mindkettőt.
- **A `shouldSendReminder` teszt nem fedi a due_soon fázisokat** név szerint (csak overdue/
  weekly/due_today) — a mostani 2 új eset viszont igen. A 4→5 nem tört semmit.
- **A `dispatchWebhook('task.overdue')` a címzett-loopon BELÜL fut** (per-recipient,
  pre-existing quirk) → most a bővebb címzett-halmaz miatt akár EGGYEL több webhook/lejárt
  task (a felelős hozzáadásával). Nem javítottam (out of scope). Ha valaha „miért megy N-szer
  a webhook", ez az ok — task-szintre kellene emelni.
- **A napi email a felelősnek is `getOrCreateBucket`-en megy át** → ha a felelős NEM tagja a
  task cégének (`user_companies`), csendben kimarad (tenant-védelem). Ez helyes; ne „javítsd".
- **Dashboard: csak a Listă nézetmód lett sima-lista.** A `myAssignedTasks` a Fülek/Kanban/
  Compact/Focus komponenseknek megy (változatlan, stádium-alapú). A „Create de mine" és a
  vezetői per-user viszont MINDEN nézetmódban `renderTaskSection`/sima-lista.
- **Szerver ESLint nem futott** (globális ESLint 10 flat-config hiányt jelez a szerver régi
  configjára) → a **`tsc --noEmit`** a kapu (0 hiba). Kliens ESLint fut, a DashboardPage 6
  jelzése mind pre-existing.
- **Nincs séma-migráció / új dependency / új cron.** Élő teszt: a napi email a következő
  07:00-s (Europe/Bucharest, Mon-Fri) futásnál; a dashboard azonnal a deploy után.

## Hivatkozások
- PRPs/011-deadline-reminder-and-dashboard-date-sort.md (a részletes terv + validáció).
- `server/src/utils/dateUtils.ts` (`shouldSendReminder`, `subtractWorkingDays`),
  `server/src/cron/emailScheduler.ts` (`runDailyEmailJob`, címzett-halmaz),
  `client/src/utils/helpers.ts` (`getEffectiveDueDate` — a rendezés kulcsa).
- Cron-táj: `emailScheduler` (91001) · `plannerRollover` (91003) · `pugStageReminders` · mind `server/src/app.ts`-ben indul.
