# 2026-05-17 — PUG (Projekt Ügymenet) alrendszer indulása

**Tags:** pug, projects, templates, attachments, mobile, public-share
**Commit:** 382efb9, 77f48bd, c7d6f86, a4b464f, 079d623, 0f3e5d4, f859b77, 95ed18b
**Related:** [[2026-05-19-i18n-hardening-wave]]

## Mit kért

Robert egy új alrendszert akart az ETM-be: PUG (Projekt Ügymenet). Ez kifejezetten a Talajradar / David-GPR típusú projekteknek készült, ahol egy ügyfél-projekt több stádiumon (Tervezés, Engedélyezés, Kivitelezés…) megy keresztül, sok feladattal, fájllal, és terepi munkával.

## Mit változott — funkciók sorrendben

- **Feladatok projekthez kötése** (`382efb9`): `tasks.project_id` mező; a feladatok hozzárendelhetők egy projekthez (vagy stand-alone-ok maradnak, mint eddig).
- **Project-scoped fájl-csatolmányok** (`77f48bd`): külön táblában tárolt projekt-szintű csatolmányok (nem feladat-szintűek).
- **Per-project PDF export** (`c7d6f86`): ügyfélbarát PDF-státusz-jelentés egy projektről.
- **Számlázási mezők projekten** (`a4b464f`): a projekten szerepelhetnek a számlázáshoz szükséges minimum-mezők.
- **Public share token** (`079d623`): minden projektre generálható egy token, amivel egy read-only oldalt meg lehet osztani az ügyféllel. Bejelentkezés nélkül elérhető.
- **Project templates** (`0f3e5d4`): újrahasznosítható projekt-sablonok (pl. "Talajradaros felmérés" sablonnak 8 előre definiált stádiuma + feladata van), amiből új projekt egy klikkel indítható.
- **Stage dependencies** (`f859b77`): a stádiumok közötti `Tervezés → Engedélyezés → Kivitelezés` sorrendet modellezi — egyik nem indulhat el, amíg az előző nincs lezárva.
- **Field-work mobile** (`95ed18b`): terepi mobilról fotó-rögzítés geotaggal egy projekthez.

## Miért — döntések

**Miért külön alrendszer és nem csak "tasks with project tag"?** A PUG ügyfél-felé fordul (PDF export, public share, számlázási mezők), és a feladatokon felüli adatmodell kell hozzá (stage dependencies, project templates). A `project_id` opcionális marad a `tasks` táblán, hogy a régi tenant-ok (Visoro Global, Hungary) változatlanul tudják használni az alapfeladatkezelést.

**Multi-tenant:** minden PUG projekt egy `company_id`-hez tartozik. A Talajradar és David-GPR cégek nagy valószínűséggel PUG-templatekkel dolgoznak.

**Public share token biztonság:** a token erős random (≥128 bit entropy), read-only, projekthez kötött. Bejelentkezés nélkül elérhető végpont, de **csak ezt az egy projektet** látja, és **csak olvasásra**. Új end-pointot ne adj hozzá public token alapon írásra.

## Gotcha jövő-Claude-nak

- A PUG projektek `template_type='project'` alatt élnek a `companies` táblában. A Visoro Global, Hungary cégek `template_type='full'` vagy `'simple'` — ne keverd össze.
- Stage dependency = új edge a projekt-stádiumok között; ha új stádium-műveletet írsz, mindig nézd meg, hogy a `blocked_by` reláció szerint indítható-e.
- Field-work mobile a fotót geotaggal együtt rögzíti — a foto EXIF GPS adatát szerver-oldalon read-only-ként megőrizzük (NEM strippeljük), mert ez audit-evidencia.
- Public share token URL-je: `/public/projects/<token>` — ez bejelentkezés nélkül elérhető. **Ne adj sehova ehhez tartozó admin-end-pointot bejelentkezés-mentesen.**
- Project templates pillanatfelvételt klónoznak — ha egy template-et utólag módosítasz, a már létrehozott projektek **nem** öröklik a változást. Ez szándékos (ügyfél-irányú stabilitás).

## Hivatkozások

- A `feat(pug)` commit-sorozat: `382efb9` → `95ed18b` (May 17, 2026).
- Templates org-aware logika (recurring tasks role-alapú assignment): `7ad30d5`.
- Subtasks comments+attachments — ez nem PUG, hanem általános feladat-feature: `474da77`.
