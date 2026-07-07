# 2026-07-06 — Org struktúra a 2026-06-30-as boardhoz: élesítve

**Tags:** org-structure, departments, sections, posts, migration, prp, railway
**Commit:** eaddaf5
**Related:** PRPs/007-org-structure-2026-07.md, server/src/database/migrations/095_org_structure_2026_07.sql, TASK.md

## Mit kért
Robert a Sarcinator (Visoro Global, company_id=1) szervezeti fáját a
2026-06-30-as org boardhoz (`Visoro_Tabel_de_organizare_SABLON.html`,
iCloud: Szemelyes asszisztens/Management/03_Szervezet_OrgBoard, mtime
2026-06-30 19:18) igazíttatta.

## Mit változott
- `server/src/database/migrations/095_org_structure_2026_07.sql` — a teljes
  átszervezés egy adat-migrációban (69 utasítás): divízió-felelősök + 28 PFV,
  szekció-átnevezések, link-őrző poszt-átnevezések/áthelyezések, D4
  Realizare/Predare 9 régi posztja hard delete, termék-alapú új posztok.
- `PRPs/007-org-structure-2026-07.md` — döntések, megfeleltetések.
- `TASK.md` — bejegyzés lezárva.

## Miért — döntések
Részletesen a PRP-ben. Röviden: menedzsment-szint (többszemélyes posztnál a
koordinátor a felelős, csapattagok a poszt-leírásban); hard delete a kikerülő
posztokra (taskjaik "Fără atribuire"-be); user-hozzárendelés név-illesztéssel,
hiányzó profilnál felelős nélkül.

## Gotcha jövő-Claude-nak
- **Majdnem elveszett a munka:** a délelőtti session megírta a csomagot, de
  push és brain-bejegyzés nélkül állt le → a délutáni session nem tudott róla,
  Robert újra kérte. Tanulság: ha egy csomag jóváhagyásra várva megáll, AKKOR
  IS írj brain-bejegyzést a függő állapotról.
- Élő ellenőrzés (Railway `DATABASE_PUBLIC_URL`-en át, csak-olvasó): minden
  guard-név egyezett, névütközés nem volt; 13 task esett a törölt posztokról
  "Fără atribuire"-be. A lokális `.env` a dev DB-re mutat — az éleshez
  `railway login` + `railway link` (ETM projekt / production / ETM service),
  majd `railway variables --service Postgres`.
- User-illesztések élesben: Róbert, Emőke, Mária, Alisa, Tímea, Lorin
  ("Lorin Bǎtinaş" — vegyes diakritika, a LIKE '%lorin%' fogta meg), András
  Kovásznai, Páll David — mind pontosan 1 találat. Vlad Ifrim, István Szőcs
  és Sergiu Tăutan profilja hiányzott → a GPR, WebGIS és Control calitate -
  RENNS posztok felelős nélkül jöttek létre. **Robert döntése (2026-07-07):
  ezekkel a kollégákkal NEM kell foglalkozni — a posztjaik szándékosan
  maradnak felelős nélkül, ne hozd fel újra.**
- Az árva taskokat Robert 2026-07-07-én szétosztotta az orfani oldalon.
  (Az oldal 3-at mutatott, nem 13-at — a migráció-előtti számolásom a
  lezárt/terminat taskokat is beleszámolta; az aktív árva 3 volt.)
- A board a posztnevekben gondolatjelet (—) használ, a DB/migráció kötőjelet
  (-) — a felületen kötőjeles nevek jelennek meg, ez szándékos.

## Hivatkozások
- PRPs/007-org-structure-2026-07.md (a teljes megfeleltetés-lista)
- brain/2026-07-06-recurring-effective-due-and-overdue-drilldown.md
  (ugyanaznap délelőtti munka)
- Ellenőrző szkript mintája: session scratchpad `live-check-095.js`
  (Railway public URL + server/node_modules/pg, csak SELECT-ek)
