# 2026-06-08 — Drawer drag-close fix + task-open 404 vizsgálat

**Tags:** tasks, task-drawer, comments, ux, multitenancy
**Commit:** 64cb532 (drawer fix); a 404 (Bug A) NYITVA
**Related:** [[2026-06-08-task-list-visibility-fixes]], [[2026-05-29-attachment-tenant-header]]

## Mit kért

Robert két dolgot jelzett, közvetlenül a task-lista deploy után:
1. **(Bug B)** @mention kommentnél, ha a beírt szöveget KIJELÖLI (húzás) küldés előtt,
   "visszaugrik az egész rendszer a dashboardra".
2. **(Bug A)** Screenshot: "Sarcina nu poate fi deschisă / Sarcina nu există sau nu ai acces
   la ea în această companie", pedig ő master admin.

## Mit változott

- [client/src/components/tasks/TaskDrawer.tsx:317](client/src/components/tasks/TaskDrawer.tsx:317)
  — a fő drawer-borító `onClick={onClose}` → `onMouseDown={(e)=>{ if (e.target===e.currentTarget) onClose(); }}`.

## Miért — döntések

**Bug B (JAVÍTVA).** A drawer háttere bármilyen rá eső kattintásra bezárt. Szöveg-húzással való
kijelölésnél a `mousedown` a mezőben (textarea) indul, a `mouseup` a háttéren ér véget — a böngésző
a `click`-et a két cél közös ősére (a háttér `div`-re) számolja → `onClose` → bezár. Ha a drawert a
**Dashboardról** nyitották (DashboardPage is nyit TaskDrawer-t), mögötte a dashboard marad →
"visszaugrott a dashboardra". Ez a klasszikus "szöveg-kijelölés bezárja a modált" hiba. Javítás:
`onMouseDown` + `e.target === e.currentTarget` őr → csak a háttéren INDULÓ lenyomás zár; a mezőben
indult húzás nem. A belső content `onClick stopPropagation` marad (immár redundáns, de ártalmatlan).
**Csak a fő (317) borítót** javítottam — a loading (275) és error (238) borítóban nincs kijelölhető
szöveg, ott nem jön elő (Surgical §4). **Pre-existing bug, nem a mai task-lista változás okozta.**

**Bug A (NYITOTT, NEM javítva).** A "Sarcina nu poate fi deschisă" a `GET /tasks/:id` 404-e
(`task_not_yours`, tasks.ts:329/335): a feladat nincs az aktív cégben VAGY törölve lett. A
megnyitás-kódot (getTaskById — csupa LEFT JOIN, tenant-check) a mai munka NEM érintette. A most
láthatóvá tett feladatok (limit 500 + "besorolás nélkül" csoport) MIND `company_id = aktív cég`
szűrtek → nyílniuk kell. Robert nem emlékezett a reprodukcióra (melyik feladat / honnan / cégváltás
után-e / Reîncearcă megoldja-e). Ezért **nem javítottam vakon** (audit-first, éles multi-tenant
rendszer). Legvalószínűbb: stale lista cégváltás után, vagy időközben törölt "ghost" feladat.

## Gotcha jövő-Claude-nak

- **Bug A NYITVA marad** (TASK.md → Blocked). Ha újra előjön, kérdezd meg: (1) melyik feladat,
  (2) honnan nyitva (lista / "besorolás nélkül" / kereső / dashboard), (3) közvetlenül cégváltás
  után-e, (4) a Reîncearcă (Újra) megoldja-e.
  - Ha "ugyanarra a feladatra mindig, Reîncearcă sem segít" → az a feladat törölt vagy másik cégé,
    és **ghost-ként** maradt a listában. Fix-irány: 404-nél a lista auto-refresh (a ghost eltűnjön),
    vagy a drawer onClose-on `onUpdate()` (loadTasks) hívása.
  - Ha "cégváltás után" → lásd a következő pont.
- **A drawer 5 mp-enként pollol** (`useTaskDetail` `refetchInterval: 5_000`, `tasksApi.get` axios
  instance-en, X-Active-Company headerrel). Ha NYITOTT drawernél céget váltasz, a következő poll a
  régi taskot az ÚJ céggel kéri → 404 → a drawer error-állapotba vált. Reális Bug A-forrás.
- **Ugyanez a backdrop-minta máshol is:** TaskDrawer loading (275) / error (238) borító, és a
  delete (650) / blocked (684) / duedate (719) modálok is `onClick`-kel zárnak. A **blocked- és
  duedate-modálban VAN input** → ugyanaz a drag-close előjöhet. Nem javítottam (nem jelentették,
  Surgical §4). Ha jön rá panasz, ugyanez az `onMouseDown`+target-őr fix.

## Hivatkozások

- Commit: 64cb532 (`fix(tasks): don't close task drawer when drag-selecting text inside it`).
- Megnyitás-végpont: [server/src/routes/tasks.ts:318](server/src/routes/tasks.ts:318) (`GET /:id`),
  getTaskById: [server/src/services/taskService.ts:15](server/src/services/taskService.ts:15),
  checkTaskAccess: [server/src/middleware/taskAccess.ts:12](server/src/middleware/taskAccess.ts:12).
- Ugyanennek a napnak a task-lista munkája: [[2026-06-08-task-list-visibility-fixes]].
- Korábbi cross-tenant/raw-fetch osztály: [[2026-05-29-attachment-tenant-header]].
