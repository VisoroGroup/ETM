# PRP: Szervezeti struktúra frissítés a 2026-06-30-as org boardhoz

## Goal
A Sarcinator (ETM) departments → sections → posts struktúrájának frissítése a
`Visoro_Tabel_de_organizare_SABLON.html` (2026-06-30) szerint, a Visoro Global
tenantra (company_id 1). A 7 divízió neve/sorrendje változatlan; a subdivíziók
és posztok szintjén nagy az átrendezés. Egyetlen adat-migráció:
`server/src/database/migrations/095_org_structure_2026_07.sql`.

## Context
- Forrás: az org board HTML (iCloud, Management/03_Szervezet_OrgBoard).
- Baseline: 053–055 + 060–064 migrációk (a 2026-05-ös seed). Élő DB-ellenőrzés
  Robert jóváhagyásával tervezett, de a Railway CLI belépés lejárt — a migráció
  ezért név-illesztéses és guard-olt (drift esetén no-op, nem korrupt).
- Robert döntései (2026-07-06):
  - A Sarcinator **menedzsment-szintű**: többszemélyes posztnál a koordinátor/
    csapatvezető a felelős (Vânzări → Alisa; Realizare → Lorin/András), a
    beosztottak a poszt leírásában.
  - Lorin BĂTINAȘ és András KOVÁSZNAI **új profilt kap**; a user-hozzárendelés
    név-illesztéssel történik — ha a profil a migráció futásakor még nincs meg,
    a poszt felelős nélkül jön létre (admin felületről pótolható).
  - A kikerülő posztok **végleges törlése** (nem deaktiválás): a rájuk osztott
    taskok "Fără atribuire"-be esnek (FK ON DELETE SET NULL), a policy-linkek
    cascade-elnek, a task_templates hivatkozásait a migráció nullázza (nincs FK).
- Kulcs-megfeleltetések (link-őrző átnevezés/áthelyezés):
  - D7: "Cazuri speciale" szekció → "Juridic și protecție"; Administrare →
    "Suport operațional"; Cazuri speciale poszt → "Protecția organizației".
  - D1: Medicina/Protecția muncii átjön a D5-ből; új "Status colegi"; Arhivă a
    Comunicare-ból a HR-be.
  - D2: Promovare poszt → "Materiale promoționale"; új Prognoză/Coordonator
    vânzări; Vânzări poszt felelőse Alisa.
  - D3: Tímea veszi át a Facturare/Încasare/Achiziții/Bază de date/Inventar
    posztokat; Întreținere patrimoniu + Consumabile átmegy a D5 Operare-ba.
  - D4: Realizare/Predare régi folyamat-posztjai TÖRÖLVE (9 db), helyettük
    termék-alapú posztok (Ortofoto, RENNS, RSV, Cartinspect, GPR, WebGIS + 5
    Control calitate + Predare proiect átnevezés).
  - D5: szekciók átnevezve (Examinare→Calificare, Performanță→Calitate
    organizațională, Verificare→Operare); "Proiecte înainte de predare"→
    "Verificare predare", "Feedback de le clienți..."→"Verificare satisfacție
    client" (átnevezés+áthelyezés, a task-linkek megmaradnak).
  - D6: Extindere szekció → "Dezvoltare rețea"; posztok átnevezve; új
    "Pregătire evenimente noi" és "Succese și referințe".
  - Divízió-felelősök: 7=Róbert, 1=Emőke, 2=Róbert, 3=Emőke, 4=Emőke,
    5=Mária, 6=Róbert. PFV-k és statisztika-nevek a boardról frissítve
    (divízió + mind a 21 subdivízió).
- Known gotchas:
  - A migráció-runner fájlonként atomikus (BEGIN/COMMIT + ROLLBACK) — vagy
    minden megy, vagy semmi. Hiba esetén a deploy elszáll, a régi verzió marad.
  - task_templates.assigned_post_id FK nélküli — törlés előtt nullázandó (benne van).
  - i18n/DEPARTMENTS konstans NEM változik (a 7 divíziónév azonos).

## Implementation Plan
1. 095-ös migráció megírása (kész) → verify: libpg-query szintaxis-parse OK
   (69 utasítás), a runner splitter-szimulációja ugyanennyit ad.
2. Élő ellenőrzés (Robert: railway login után) → verify: a baseline-nevek
   megvannak az élő DB-ben; user-név-illesztések pontosan 1 találatot adnak.
3. Push → Railway deploy futtatja → verify: Robert a Sarcinator szervezeti
   nézetében (Sarcini, org fa) látja az új struktúrát.

## Validation Loop
- Szintaxis: libpg-query parse — OK.
- Élő smoke: deploy után az org nézet mutatja az új subdivíziókat/posztokat;
  egy régi (törölt posztra osztott) task a "Fără atribuire" csoportban van.

## Out of Scope
- User-profilok létrehozása (Lorin, András, Tímea, Ana, értékesítők) — admin
  felületről történik; a migráció név-illesztéssel dolgozik, ha léteznek.
- A client-oldali DEPARTMENTS konstans és i18n kulcsok (változatlanok).
- Hungary/Neo Plan tenantok (nincs org-struktúrájuk; minden utasítás
  company_id=1-re szűrt).
