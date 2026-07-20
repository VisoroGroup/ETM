# 2026-07-20 — „Felelős" legördülő üres, ha a felelős már nem céges tag

**Tags:** tasks, task-drawer, assignee, multitenancy, user-companies, membership, frontend
**Commit:** 0836508
**Related:** [[2026-07-06-org-structure-package-pending]] (név-illesztéses user-hozzárendelés, hiányzó profilok), [[2026-06-08-task-list-visibility-fixes]] („Fără atribuire" besorolatlan taskok)

## ⚠️ KORREKCIÓ (2026-07-20, élő DB-ellenőrzés után)
A lenti „árva tagság" gyökér-ok **TÉVES volt**. Élő Railway-ellenőrzés (Postgres,
csak-olvasó) bizonyítja:
- **Nemess Viktor TAGJA Visoro Hungarynak** (`user_companies` sor megvan),
  `active=true`, `role=user`. Nincs hiányzó tagsága.
- A „Balogh P…" task (id 721a8503…, company_id=2) **rá van szignálva** Viktorra.
- A **szerver `/auth/users` lekérdezése Visoro Hungaryra VISSZAADJA Viktort** (4
  user: Emőke/Mária admin, Róbert superadmin, Viktor user). A szerver sosem volt a hiba.
- **Egyetlen árva ember sincs** egyik cégben sem (orphan-check üres).

**Az IGAZI gyökér-ok:** a **kliens `users` listája elavult** volt — egy MÁSIK cég
(vsz. Visoro Global) listája, ahol Viktor nem tag. Ezért látszottak az adminok
(ők minden cégben ott vannak a `role`-ág miatt), de Viktor (Hungary-only sima user)
nem. Ez PONTOSAN a `useAuth.tsx:156-162` kommentben leírt ismert tünet: a
company-váltáskori `authApi.users()` re-fetch **silent `.catch(()=>{})`**-tal bukik
(useAuth:166), a company-váltás pedig **aborttal öli a futó kéréseket** (api.ts:30)
→ ha a re-fetch elveszti a versenyt, a lista csendben elavult marad.

**A javításom (0836508, `assigneeOptions`) így is HELYES és a legrobusztusabb**: a
jelenlegi felelőst a task denormalizált nevéből mindig megmutatja, akár elavult a
lista, akár tényleg árva. A tünet megoldva. A lenti „árva" narratíva viszont
hipotézis volt, amit az élő adat megcáfolt — a PRP 009 őrök és a PRP 010 valós
árvákat céloznak, amikből JELENLEG NULLA van (lásd [[2026-07-20-membership-integrity-guards]] korrekció).

## Mit kért
Robert screenshotot küldött Visoro Hungaryból: egy feladat „Felelős" legördülője
„Nincs felelős"-t mutat, miközben a név-chip **Nemess Viktort** mutatja (ő a
létrehozó ÉS a felelős). Kérdés: miért jelennek meg *más* munkatársak a listában,
és miért nem Viktor, aki kellene — „nincsenek összekötve rendesen a munkatársak a
projektekhez". Döntése: **tartós kód-javítás** (nem csak ennek az egy taskusnak az
adata).

## Mit változott
- `client/src/utils/helpers.ts` — új `assigneeOptions(users, currentId, currentName)`
  tiszta függvény: a cég-tagokból építi az opciókat, de ha a jelenlegi felelős
  nincs köztük, egy szintetikus sort tesz elé (a beégetett névből). Csak
  megjelenítés.
- `client/src/components/tasks/TaskDrawer.tsx:~587` — a felelős-`<select>` ezt
  használja `task.assigned_to` + `task.assignee_name`-mel.
- `client/src/components/tasks/tabs/SubtasksTab.tsx:~205` — ugyanez a részfeladat
  felelősére `subtask.assigned_to` + `subtask.assigned_to_name`-mel.
- `client/src/whatsnew/releases.ts` — release id 4 (RO+HU).
- `TASK.md` — Active bejegyzés a diagnózissal.

## Miért — döntések
- **Gyökérok (kódból, adversarial Workflow-val megerősítve):** a legördülő opciói
  a `GET /auth/users`-ből jönnek (`server/src/routes/auth.ts:~641`), ami CSAK azt
  adja vissza: `is_active = true AND (role IN ('admin','superadmin') OR van
  user_companies sor az aktív céghez)`. Nemess Viktor sima `user`, akinek **nincs
  user_companies sora Visoro Hungaryhoz** → kiesik. A feladat viszont rá van
  szignálva, és a `assignee_name` a task-lekérdezésben **denormalizált**
  (`taskService.ts:18,36` — `LEFT JOIN users au ON t.assigned_to = au.id`), ezért a
  chip jól mutatja, a `<select value={id}>` viszont üres opcióra esik vissza
  (nincs matchelő `<option>`).
- **Miért „más munkatársak" látszanak:** a `role IN ('admin','superadmin')` ág
  miatt **minden admin/superadmin bekerül MINDEN cég** legördülőjébe, akkor is, ha
  nem tagja. Így Visoro Global-os adminok látszanak a magyar cégnél, a tényleges
  magyar ember meg hiányzik.
- **Display-only fix, nem adat-javítás:** Robert a kódot javíttatta. A helper
  láthatóvá teszi a felelőst, de **nem teszi Viktort újra választhatóvá** más
  magyar feladatokhoz — ahhoz az Admin felületen kell neki Visoro Hungary tagságot
  adni (külön, adat-szintű lépés, lásd lent).
- **TaskFormModal kimaradt:** az csak **létrehozásra** való (`Props = {onClose,
  onCreated}`, nincs `task` prop, `assignedTo` üresről indul) → nincs árva érték.
- **Nincs kliens teszt-futtató** (se vitest/jest) → új dependency Robert engedélye
  nélkül nem megy; a tiszta helpert a `tsc -b && vite build` fedi.

## Gotcha jövő-Claude-nak
- **Ez rendszerszintű, nem egyedi.** Több magyar kolléga is lehet „árva". A
  javítás csak a TÜNETET (üres select) szünteti meg, az OKOT (hiányzó
  user_companies) nem.
- **Hogyan lesz valaki „árva" (a legvalószínűbb okok):**
  1. **Admin volt → visszaminősítették `user`-ré.** Admin/superadmin a
     `loadCompanyContext`-ben (`middleware/auth.ts:29-33`) MINDEN nem-archivált
     céget megkap, tehát tagság nélkül is tud bárhol feladatot létrehozni/kapni;
     downgrade után explicit tagság nélkül eltűnik. Ez a legtisztább magyarázat.
  2. **Tagsága törlődött** a cég-hozzáférés-átíró végponton (`admin.ts:~151`
     PUT /admin/users/:id/companies — **teljes DELETE + újra-INSERT**; ha egy cég
     pipa lemarad, csendben törli).
  3. **Ismétlődő/sablon/duplikálás továbbviszi.** A recurring materializáció
     (`tasks.ts:~596-607`), a template `/use` (`templates.ts:~195`) és a
     `duplicateTask` (`taskService.ts:~607`) **változatlanul másolja** a
     created_by/assigned_to-t, **tagság-újraellenőrzés nélkül** → egy régen
     beállított sorozat a felelős kilépése után is újratermel rá szóló taskot. Ha
     a task „Ismétlődő", ez az erős tipp.
- **A belépés NEM hoz létre user_companies sort** — se SSO, se magic-link
  (`auth.ts` login: csak `INSERT INTO users ... ON CONFLICT (microsoft_id)`; minden
  user_companies hivatkozás ott SELECT). **Nincs önjavítás**, csak admin adhat
  tagságot.
- **`userIsInCompany` (`utils/tenantGuard.ts:12-24`)** ugyanazt a predikátumot
  használja, mint a dropdown-query → csak pillanatnyi (create-time) snapshot, nem
  tartós invariáns.
- Ha ez a minta MÁSHOL is felüti a fejét (bármely `<select value={storedId}>`,
  aminek az opciói a cég-tagokra szűrt `users`-ből jönnek), ugyanez a helper a
  megoldás: `assigneeOptions(users, id, name)`.

## Hivatkozások
- Diagnózis Workflow (4 agent, adversarial verify): session scratchpad
  `workflows/scripts/diagnose-assignee-membership-*.js`. A verifier verdict:
  „mechanism CONFIRMED"; ranked causes = admin-downgrade / tagság-törlés / recurring
  propagáció a legvalószínűbbek.
- Kulcsfájlok: `server/src/routes/auth.ts` (/auth/users + login), 
  `server/src/middleware/auth.ts` (loadCompanyContext), 
  `server/src/services/taskService.ts` (denormalizált assignee_name),
  `server/src/routes/admin.ts` (tagság-átírás), `server/src/utils/tenantGuard.ts`.
- Megelőzés (opcionális, Robert kérte a PRP-t): `PRPs/009-membership-integrity-guards.md`.
