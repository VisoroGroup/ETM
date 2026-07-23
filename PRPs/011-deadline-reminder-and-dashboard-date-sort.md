# PRP: Határidő-emlékeztető (5/2/1) + Dashboard dátum szerinti rendezés

**Státusz:** Approved (Robert, 2026-07-21, „csinald") → In progress
**Indítva:** 2026-07-21
**Bejelentő:** Robert

## Goal

Két, egymástól független változás egy kérésben:

1. **Dashboard (Listă nézet):** a feladatok ne **stádium** szerint csoportosítva
   jelenjenek meg, hanem egyetlen, **határidő szerint** rendezett listaként — a
   legközelebbi esedékesség legfelül, onnan lefelé. A Listă nézet **mindhárom**
   szekciójára vonatkozik (Sarcinile mele, Create de mine, vezetői per-user).

2. **Határidő-email:** a **meglévő** napi összefoglaló email (`emailScheduler.ts`)
   emlékeztetője a határidő előtt **4 helyett 5 munkanappal** induljon (így 5/2/1),
   és a **felelős** (`assigned_to`) is kapja meg — jelenleg kimarad. Nincs új cron,
   nincs dupla email.

## Context

### Meglévő állapot (feltérképezve)

- A Dashboard „Listă" nézete a `client/src/components/dashboard/DashboardPage.tsx`
  `groupByStatus()` függvényével csoportosít (De rezolvat / În realizare / Blocat),
  és csak a csoporton **belül** rendez `due_date` szerint. Használat: `renderTaskSection`
  (Sarcinile mele + Create de mine) és a vezetői per-user blokk (`groupByStatus(bucket.tasks)`).
- A `emailScheduler.ts` napi 07:00-kor (Mon-Fri, lock 91001) egy per-user digestet
  küld. A `shouldSendReminder` (`utils/dateUtils.ts`) fázisai: `overdue` (naponta),
  `4_days_before` / `2_days_before` / `1_day_before`, `due_today`, `weekly` (hétfő, ha >7 nap).
  **A digest jelenleg a létrehozónak + subtask-felelősöknek megy — a fő felelős kimarad.**
- Külön cron a `pugStageReminders.ts`, de az CSAK PUG projekt-szakaszokra (`project`
  sablon) — **nem** ütközik a sima feladatokkal.

### Files to read / modify

- `client/src/components/dashboard/DashboardPage.tsx` — a rendezés.
- `client/src/utils/helpers.ts` — `getEffectiveDueDate` (rekurens-tudatos dátum; a
  rendezés kulcsa, hogy a megjelenített dátummal egyezzen).
- `server/src/utils/dateUtils.ts` — `shouldSendReminder` (4→5).
- `server/src/cron/emailScheduler.ts` — fázis-string + címzett-halmaz.
- `server/src/__tests__/unit/dateUtils.test.ts` — új teszt az 5-napos fázisra.
- `client/src/whatsnew/releases.ts` — release id 9 (RO+HU).

### Ismert gotchák

- **Rendezés effektív dátum szerint:** a sor a `getEffectiveDueDate`-et **jeleníti
  meg** (rolled rekurens task jövőbeli dátumot mutat). A rendezésnek is ezt kell
  használnia, különben egy rolled task a nyers múltbeli dátuma miatt felülre kerülne,
  de jövőbeli dátumot mutatna — zavaró. (Lásd brain 2026-07-06.)
- **`diff <= 7` ág:** 5 munkanap egy hétköznapi határidő előtt = 7 naptári nap →
  `diff === 7`, ami még `<= 7`, tehát az 5-napos ellenőrzés elérhető. A `weekly`
  (hétfői) csak `diff > 7`-nél sül el → nincs ütközés.
- **A `4_days_before` fázis-stringnek egyetlen fogyasztója van** (`emailScheduler.ts:307`)
  és egyetlen előállítója (`dateUtils.ts:111`). Mindkettőt átírom `5_days_before`-ra.
- A `shouldSendReminder` teszt NEM ellenőrzi a `4_days_before` fázist → a meglévő
  tesztek nem törnek; újat írok az 5-napos esetre.
- Az email `due_in_days` a valós **naptári** napokat írja ki (`{{days}}`), nem a
  „munkanap-küszöböt" — ez ma is így van, marad. 5 munkanap ≈ „7 nap múlva esedékes".

## Implementation Plan

### A. Dashboard — dátum szerinti sima lista

1. Új segéd a `DashboardPage`-ben: `sortByDueDate(tasks)` — `getEffectiveDueDate`
   szerinti növekvő rendezés; a **blocat** és a **dátum nélküli** taskok a lista
   **aljára** kerülnek (paused/undated → `Infinity` kulcs). → verify: legközelebbi
   határidő legfelül, blocat alul.
2. `renderTaskSection`: a `groupByStatus(...)` szerinti státusz-alcsoportok (a
   státusz-fejléc gombokkal) **helyett** egyetlen `sortByDueDate(tasks).map(renderTaskRow)`
   lista. A **szekció-szintű** összecsukás (fő fejléc + count) és az üres-állapot
   marad. → verify: nincs többé „De rezolvat/În realizare/Blocat" alfejléc a szekción belül.
3. Vezetői per-user blokk: `groupByStatus(bucket.tasks).map(...)` → `sortByDueDate(bucket.tasks).map(renderTaskRow(..., false))`.
   → verify: user-buckets tartalma dátum szerinti sima lista.
4. Árvák eltávolítása (§4): a `groupByStatus` és `statusOrder` törölhető (nincs több
   használat); a `STATUSES` import **marad** (a `renderTaskRow` a státusz-színhez
   használja). A státusz-alszintű `collapsedStatuses` kulcsok (`${key}_${status}`)
   megszűnnek; a `sect_*` és `user_*` kulcsok maradnak. → verify: `tsc -b && vite build` zöld, nincs unused.

### B. Határidő-email — 5/2/1 + felelős

5. `dateUtils.ts` `shouldSendReminder`: `subtractWorkingDays(dueDate, 4)` → `..., 5)`,
   `fourBefore` → `fiveBefore`, fázis `'4_days_before'` → `'5_days_before'`; a doc-komment
   „4, 2, 1" → „5, 2, 1". → verify: új unit teszt zöld.
6. `emailScheduler.ts:307`: `phase === '4_days_before'` → `'5_days_before'`.
7. `emailScheduler.ts` címzettek (jelenleg `{created_by} ∪ subtaskAssignees`):
   → **additív**: `{assigned_to (ha van)} ∪ {created_by} ∪ subtaskAssignees`. A felelőst
   HOZZÁADom, a létrehozó + subtask-felelősök maradnak (Robert: „maradjanak bent").
   → verify: a felelős + létrehozó + subtask-felelősök kapják a digestet; szerver `tsc` zöld.
8. Új teszt a `dateUtils.test.ts`-ben: 5 munkanappal a határidő előtt → `phase === '5_days_before'`,
   `send === true` (happy path) + egy nem-küldő nap (edge). → verify: `npm test` zöld.

### C. Kötelező kísérők

9. `releases.ts`: release id 9 (RO+HU) — „Dashboard: feladatok határidő szerint" +
   „Határidő-emlékeztető 5 nappal előbb, a felelősnek is".
10. `TASK.md`: Active bejegyzés. Brain-entry push után.

## Validation Loop

- **Szerver:** `cd server && npx tsc --noEmit` (vagy `tsc -b`) → 0 hiba;
  `cd server && npm test` → a `dateUtils` suite zöld (a régi 5 + az új esetek).
- **Kliens:** `cd client && npx tsc -b && npx vite build` → zöld; ESLint az érintett
  fájlon 0 új hiba (a DashboardPage pre-existing eslint-errorjai — a build a kapu).
- **Manuális (Robert, deploy után):**
  - Dashboard → Listă nézet: a „Sarcinile mele" egyetlen lista, legfelül a
    legközelebbi határidő, blocat alul; nincs stádium-alfejléc. Ugyanez a „Create de
    mine"-nál és (adminként) a per-user szekcióban.
  - Email: a 07:00-s napi email a felelősnek is megérkezik; a „hamarosan lejár"
    szekció 5 munkanappal a határidő előtt indul. (Élesben a következő futásnál látszik.)

## Out of Scope

- **Címzett = additív** (Robert végső döntése, 2026-07-21 „maradjanak bent"): a
  felelőst (`assigned_to`) HOZZÁADjuk a meglévő létrehozó + subtask-felelős körhöz;
  senki nem esik ki, csak a felelős kerül be. (Az AskUserQuestion-ben „felelős +
  létrehozó" volt, de a subtask-mellékhatás felvetése után Robert az additívat kérte.)
- A többi Dashboard **nézetmód** (Fülek / Kanban / Compact / Focus / Calendar)
  változatlan — azok eleve stádium-alapúak.
- A `dispatchWebhook('task.overdue')` per-címzett elsülése (pre-existing) — nem nyúlok hozzá.
- Naptári vs. munkanap: **munkanap** marad (a rendszer végig arra épül). 5 munkanap ≈ 7 naptári nap.
- Nincs séma-migráció, nincs új dependency, nincs új cron.
