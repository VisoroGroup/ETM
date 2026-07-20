# 2026-07-20 — Tagság-integritás őrök (árva felelős megelőzése, PRP 009)

**Tags:** tasks, multitenancy, user-companies, membership, recurring, templates, duplicate, admin, prp
**Commit:** de162ab
**Related:** PRPs/009-membership-integrity-guards.md, PRPs/010-orphaned-tasks-remediation.md, [[2026-07-20-assignee-picker-orphaned-member]] (a display-fix, ami a tünetet kezelte)

## Mit kért
A [[2026-07-20-assignee-picker-orphaned-member]] diagnózis után Robert a
megelőzést kérte (PRP 009), **mindkét irányt** ("mindkettő"): (A) figyelmeztetés,
ha a cég-hozzáférés szűkítésekor egy usertől olyan céget vennél el, ahol nyitott
feladata van; (B) tagság-újraellenőrzés a feladat-másoló utakon, hogy ne
termeljenek újra árva felelőst. Plusz külön: a MEGLÉVŐ árva feladatok rendezésének
biztonságos terve (PRP 010).

## Mit változott
**(A) Figyelmeztetés (cég-hozzáférés szűkítés):**
- `server/src/routes/admin.ts` — új `GET /users/:id/task-counts?company_ids=1,2`
  (superadmin), a user NYITOTT (nem `terminat`, nem törölt), **rá szignált**
  (`assigned_to`) feladatainak száma cégenként. **Csak `assigned_to`** — a
  `created_by` történeti, a hozzáférés-elvétel nem árvásítja (ez volt a review
  low-sev findingja, javítva).
- `client/src/services/api.ts` — `adminUserCompaniesApi.taskCounts`.
- `client/src/components/admin/CompaniesAdminPage.tsx` — a `UserCompanyAccessModal`
  mentés előtt kiszámolja a KIVETT cégeket (`user.company_ids − selected`), lekéri
  a számokat, és ha van érintett, egy borostyán megerősítő panelt mutat (cégenkénti
  „N nyitott feladat"), „Igen, eltávolítom" gombbal. Csekk-hiba esetén fail-open
  (nem blokkol). i18n RO+HU (`admin_companies.removal_warning_*`).

**(B) Másolás-őr (ne örökítse az árva felelőst):**
- `server/src/routes/tasks.ts` (~588) — ismétlődő materializáció: `recurAssignee =
  task.assigned_to && userIsInCompany(...) ? task.assigned_to : null`, a guard a
  tranzakció ELŐTT fut.
- `server/src/routes/templates.ts` (~193) — sablon `/use`: ha `resolvedAssignee`
  már nem tag → null.
- `server/src/services/taskService.ts` (~607) — `duplicateTask`: `dupAssignee`
  guard (+ új `userIsInCompany` import). (A subtask-assignee-t a duplikálás amúgy
  is nullázta.)
- `client/src/whatsnew/releases.ts` — release id 5 (RO+HU).

**Terv a meglévőkre:** `PRPs/010-orphaned-tasks-remediation.md` (read-first,
visszafordítható, Robert tételes döntésével; éles írás csak OK-val).

## Miért — döntések
- **Warning csak `assigned_to`-ra:** a `created_by` a hozzáférés elvételekor sem
  árvul (a display denormalizált, és a B se nyúl a created_by-hoz). A `created_by`
  beszámítása hamis riasztást adott volna (review finding) — kivettem.
- **B = unassign, nem blokkolás:** a másolt feladat felelős nélkül jön létre (nem
  hiba, nem elutasítás), hogy újra ki lehessen osztani. A `userIsInCompany` az
  admin/superadmint bent tartja → valódi tagot/vezetőt SOSE nulláz.
- **Fail-open a warning-csekknél:** ha a task-counts hívás hibázik, a mentés
  megy tovább (az admin saját műveletét ne blokkolja egy melléklekérdezés).

## Gotcha jövő-Claude-nak
- **A B-guard tiszta megjelenítés-mentes:** csak akkor változtat, ha a felelős
  MÁR árva. Ha valaha egy legitim felelős eltűnne a másolatokról, előbb a
  `userIsInCompany`-t (`utils/tenantGuard.ts`) nézd — is_active + (admin VAGY
  user_companies).
- **A subtask-assignee továbbörökítése az ismétlődő ÉS a sablon úton NINCS
  guardolva** (csak a fő task `assigned_to`). Szándékos szűkítés a PRP-hez; a
  display-fix (0836508) amúgy is láthatóvá teszi. Ha kell, ott is `userIsInCompany`
  / `filterUsersInCompany`.
- **PRP 010 (meglévő árvák) MÉG NINCS végrehajtva** — az adat-művelet, Robert
  tételes döntéseit + belinkelt Railwayt igényel. A diagnosztika kész:
  `scratchpad/orphan-members-check.js` (READ-only). Innen a Railwayt nem tudtam
  belinkelni (interaktív `railway login`).
- **A warning UI a `UserCompanyAccessModal`-ban van (CompaniesAdminPage), NEM az
  AdminPage-ben** — az AdminPage-nek külön van a user-létrehozási cég-pipa listája
  (`newUser.company_ids`), az egy MÁSIK folyamat (új user), oda nem kell warning.

## Hivatkozások
- Review: session `workflows/scripts/review-membership-guards-*.js` (2 agent,
  correctness + tenant/regressió; verdict: safe-to-ship, 1 low-sev javítva).
- [[2026-07-20-assignee-picker-orphaned-member]] — a gyökér-diagnózis + a display-fix.
- Kulcs: `server/src/utils/tenantGuard.ts` (`userIsInCompany`).
