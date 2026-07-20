# PRP: Tagság-integritás őrök (árva felelős megelőzése)

**Státusz:** Draft — Robert jóváhagyására vár (2026-07-20)
**Kiváltó ok:** brain/2026-07-20-assignee-picker-orphaned-member.md
**Kapcsolódó:** a 0836508 megjelenítési fix (a TÜNETET kezeli); ez a PRP az OKOT.

## Goal
Megakadályozni, hogy feladatok „árva" felelőssel jöjjenek létre vagy maradjanak
— vagyis olyasvalakivel, aki már nem tagja az adott cégnek. A 0836508 fix a
felelőst már láthatóvá teszi a legördülőben; ez a PRP azt célozza, hogy új árva
állapot lehetőleg ne is keletkezzen, illetve az adminnak legyen figyelmeztetése,
mielőtt akaratlanul „elveszi" egy usertől a feladatait.

**Két, egymástól független irány (Robert döntheti el, melyik kell — vagy
mindkettő):**

### A. Figyelmeztetés a cég-hozzáférés szerkesztésekor
Amikor az admin egy user cég-listájából **kivenne** egy céget, ahol a usernek
**nyitott feladata** van (rá szignálva vagy általa létrehozva), a mentés előtt
kapjon egy megerősítő párbeszédet a hatás felsorolásával (hány feladat, melyik
cégben), és csak tudatos „Igen, veszem el" után mentsen.

### B. Tagság-újraellenőrzés a feladat-sokszorosító utakon
A feladatot **továbbmásoló** három út (ismétlődő materializáció, sablon `/use`,
duplikálás) a másolás előtt ellenőrizze, hogy a `assigned_to` még tagja-e a
cégnek; ha nem, a másolt feladat **felelős nélkül** (unassigned) jöjjön létre,
ne örökítse tovább az árva felelőst. (A `created_by` marad — az történeti tény,
és nem okoz üres-select tünetet.)

## Context
- **Files to read:**
  - `server/src/routes/admin.ts` — `PUT /admin/users/:id/companies` (~118. sor,
    teljes DELETE + újra-INSERT); `PATCH /admin/users/:id` (~181) — a másik hely,
    ahol tagság módosulhat.
  - `client/src/components/admin/…` — a cég-hozzáférés szerkesztő UI
    (`adminApi.setUserCompanies`, `client/src/services/api.ts:465`
    `PUT /admin/users/:id/companies`). A pontos komponenst az implementáció
    elején be kell azonosítani (AdminPage vagy külön UsersAdmin panel).
  - `server/src/routes/tasks.ts` — ismétlődő materializáció (~596–607. sor).
  - `server/src/routes/templates.ts` — sablon `/use` (~195. sor).
  - `server/src/services/taskService.ts` — `duplicateTask` (~607. sor).
  - `server/src/utils/tenantGuard.ts` — `userIsInCompany(userId, companyId)`
    (12–24), ezt kell újrahasználni a B. részhez.
- **Existing patterns to follow:**
  - Tenant-guard: `userIsInCompany` (már létező, admin/superadmin mindig true).
  - A POST /tasks már csinál assignee-tagság ellenőrzést (`tasks.ts:315`
    `assignee_not_in_company` hiba) — a B. rész ennek a szellemét viszi a
    másoló utakra, de NEM hibát dob, hanem csendben unassigned-re esik.
  - Admin megerősítő UI: kövessük a meglévő admin-modál/confirm mintát.
- **Known gotchas:**
  - Admin/superadmin a `userIsInCompany`-ban MINDIG bent van → őket sose
    minősítsük „árvának" (helyes, ne örökítsük tovább rájuk a törlést).
  - A `PUT /admin/users/:id/companies` teljes lista-csere; az „érintett feladat"
    számot a RÉGI és ÚJ lista különbségéből kell számolni (kivett cégek).
  - Az ismétlődő materializáció a `status → terminat` úton fut (nem cron) —
    a B. ellenőrzést pont az INSERT elé kell tenni, egy DB-körrel.
  - i18n: minden új szöveg RO + HU (en.json nem kap, RO-fallback).

## Implementation Plan

### A rész (figyelmeztetés)
1. **Backend:** új végpont vagy a meglévő PUT kiterjesztése egy „dry-run"
   móddal: `GET /admin/users/:id/company-removal-impact?company_ids=…` ami
   visszaadja a kivenni tervezett cégenként a user nyitott feladatainak számát
   (`created_by = :id OR assigned_to = :id`, `company_id = X`, státusz nem
   terminat). → verify: kézi hívás, helyes számok.
2. **Frontend:** a cég-hozzáférés mentése előtt, ha a kivett cégekben van
   érintett feladat, megerősítő modál a listával; csak „Igen" után hívja a PUT-ot.
   → verify: pipa kivétele → modál felugrik a helyes számmal.
3. i18n RO+HU. → verify: mindkét nyelven olvasható.

### B rész (másolás-őr)
4. **Ismétlődő** (`tasks.ts:~596`): az INSERT elé egy `userIsInCompany(
   task.assigned_to, task.company_id)` — ha false, a másolt sor `assigned_to =
   NULL`. → verify: árva felelősű ismétlődő task lezárása → az új példány
   unassigned.
5. **Sablon `/use`** (`templates.ts:~195`) és **duplikálás**
   (`taskService.ts:~607`): ugyanez a guard a `resolvedAssignee` /
   `original.assigned_to` köré. → verify: árva felelősű sablonból/duplikálásból
   unassigned task.
6. (Opcionális) activity-log bejegyzés, hogy „a felelős kilépett, a feladat
   felelős nélkül jött létre" — csak ha Robert kéri.

## Validation Loop
- `cd server && npx tsc` zöld; `cd client && npx tsc -b && npx vite build` zöld.
- ESLint az érintett fájlokon: 0 ÚJ hiba (a pre-existing nem az én dolgom).
- Manuális (éles, deploy után): (A) próbáld kivenni egy usertől a Visoro Hungary
  pipát, akinek van ottani feladata → figyelmeztetés. (B) zárj le egy árva
  felelősű ismétlődő feladatot → az új példány „Nincs felelős".

## Out of Scope
- **Meglévő árva feladatok tömeges javítása** — ez adat-művelet, nem kód (külön,
  Admin felületről vagy külön migrációval).
- A `created_by` „gyógyítása" — az történeti, marad.
- A `/auth/users` dropdown-logika megváltoztatása (az admin-leak szándékos:
  admin/superadmin minden cégben elérhető felelős marad).
- Automatikus újra-hozzárendelés más userre (nem találgatunk felelőst).
