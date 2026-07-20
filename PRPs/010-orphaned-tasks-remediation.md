# PRP: Meglévő „árva" feladatok biztonságos rendezése (adat-remediáció)

**Státusz:** Draft — Robert jóváhagyására vár (2026-07-20)
**Típus:** Egyszeri, éles adat-művelet (NEM kód-feature). Külön kezelendő.
**Kapcsolódó:** brain/2026-07-20-assignee-picker-orphaned-member.md, PRPs/009-membership-integrity-guards.md

## Goal
A már létező „árva" feladatok rendezése éles adatban: azok, amelyeknek a
felelőse (`assigned_to`) vagy létrehozója (`created_by`) olyan user, akinek
**nincs `user_companies` sora** az adott céghez (és nem admin/superadmin). A cél
NEM tömeges automatizmus, hanem egy **biztonságos, ember-által-döntött, naplózott
és visszafordítható** folyamat. A 0836508 fix miatt ezek a feladatok már nem
„tűnnek el" a felületről — ez a remediáció a mögöttes adatot rendezi.

## Alapelvek (kemény korlátok)
1. **Előbb OLVASÁS.** Semmilyen írás, amíg a teljes érintett lista nincs Robert
   előtt és ő tételesen nem döntött.
2. **Soha nincs törlés.** Feladatot NEM törlünk. Usert NEM törlünk. Csak
   `user_companies` sort adunk hozzá, vagy `tasks.assigned_to`-t nullázunk.
3. **Tranzakció + napló.** Minden írás egyetlen tranzakcióban, előtte a
   módosítandó sorok kimentése (before-image) egy `scratchpad` fájlba, hogy
   visszafordítható legyen.
4. **Éles DB csak Robert kifejezett OK-jával**, futás közben is (CLAUDE.md §9).
   A Claude nem nyúl éles adathoz engedély nélkül; a WRITE lépést Robert
   indítja vagy kifejezetten engedélyezi.

## Context
- Diagnosztika (READ-only, kész): `scratchpad/orphan-members-check.js` — cégenként
  kilistázza az árva (user, cég) párokat.
- Írás-felület, ha kézi: Admin → Felhasználók → user → céghozzáférés (a
  `PUT /admin/users/:id/companies`, superadmin).
- Kulcstáblák: `user_companies (user_id, company_id)`, `tasks (assigned_to,
  created_by, company_id, status, deleted_at)`, `users (id, role, is_active)`.
- Éles elérés: Railway `DATABASE_PUBLIC_URL` (a brain org-struktúra bejegyzés
  mintája: `railway login` + `railway link` + `railway variables --service Postgres`).

## Döntési mátrix (Robert tölti ki, személyenként)
Minden árva (user, cég) párnál Robert dönt:
- **(R) Re-link:** a user valóban a cég tagja kell legyen → `INSERT INTO
  user_companies`. Ez visszaadja a láthatóságot ÉS a választhatóságot. (Ez a
  „munkatársak összekötése a projektekhez", amit eredetileg kértél.)
- **(U) Unassign:** a user NEM tag többé, a feladat kerüljön felelős nélküli
  állapotba → `UPDATE tasks SET assigned_to = NULL`. (A `created_by` marad —
  történeti.)
- **(H) Hagyd:** nincs teendő (a display-fix miatt így is látszik).

## Implementation Plan
1. **READ — teljes lista.** Futtatás: `orphan-members-check.js` (belinkelt
   Railway kell). Kimenet: cégenként (user, szerep-a-feladaton, érintett-szám).
   → verify: a lista értelmes, a számok stimmelnek egy-két kézi ellenőrzéssel.
2. **DÖNTÉS.** Robert minden sorhoz megadja: R / U / H. (Táblázatban vagy szóban.)
3. **BACKUP.** A WRITE előtt a script kimenti a módosítandó sorokat
   (`user_companies` beszúrandók listája + a nullázandó `tasks` before-image-e)
   egy időbélyeges scratchpad JSON-ba.
4. **WRITE (Robert OK-jával).** Egyetlen tranzakció:
   - (R): `INSERT INTO user_companies (user_id, company_id) VALUES (...)
     ON CONFLICT DO NOTHING` a jóváhagyott párokra.
   - (U): `UPDATE tasks SET assigned_to = NULL WHERE id = ANY(...)` a jóváhagyott
     feladatokra (csak nem-`terminat`, nem törölt).
   - COMMIT. → verify: az érintett sorok a várt állapotban; a diagnosztika újra
     futtatva üres (vagy csak a „H"- nak jelölt sorok maradnak).
5. **ELLENŐRZÉS a felületen.** Néhány érintett feladat drawer-jében a felelős a
   várt (R esetén a user újra választható; U esetén „Nincs felelős").

## Validation Loop
- A WRITE tranzakció `RETURNING`-gel visszaadja a tényleges változást; a script
  összeveti a jóváhagyott listával, eltérésnél ROLLBACK.
- Rollback-terv: a before-image JSON-ból a `user_companies` beszúrások törölhetők
  és a `tasks.assigned_to` visszaírható, ha valami félrement.

## Out of Scope
- A `created_by` átírása (történeti, marad).
- Automatikus döntés arról, ki legyen tag — ezt Robert dönti.
- Bármilyen törlés (feladat, user, tagság-tömegtörlés).
- Kód-változás — ez tisztán adat-művelet; a megelőzés a PRP 009.
