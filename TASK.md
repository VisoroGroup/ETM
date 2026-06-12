# TASK.md

> A `CLAUDE.md` 6. szekciója szerint: minden feladat előtt nézd át
> ezt a fájlt. Ha a feladat nincs itt, add hozzá.
>
> **Append-only.** Ne töröld a kész feladatokat — mozgasd a "Done"
> szekcióba.
>
> **Státuszok:** `[ ]` todo · `[~]` folyamatban · `[x]` kész · `[!]` blokkolt · `[-]` törölve

---

## Active

### `[~]` Email-link navigáció + lista-megbízhatóság (Emo bejelentések köre)
- **Hozzáadva:** 2026-06-12 · **Bejelentő:** Emo (Roberton keresztül) · **PRP:** PRPs/003-email-link-navigation-and-list-reliability.md
- **Akceptálási kritérium:** (1) lejárt belépésnél az email-link a belépés után is a
  taskhoz visz (MS365 + magic link); (2) nyitott app-fül mellett a link nem hagy üres
  lapot — a task helyben nyílik; (3) komment-email a kommenthez görget; (4) a két
  szűrőgomb gyors váltásánál nem ragad be elavult lista; (5) deploy után a régi
  böngésző-verzió egyszer magától újratölt chunk-hiba helyett.

---

## Backlog

### `[ ]` Megfontolandó: közös `authedFetch` wrapper — 3. előfordulás elérve
- **Hozzáadva:** 2026-05-29 · **Eszkalálva:** 2026-06-04
- **Megjegyzés:** A "raw fetch kihagyta az X-Active-Company headert" osztályú bug
  immár HARMADSZOR jött elő (1. email-link, 2. csatolmány, 3. havi riport — utóbbinál
  ráadásul rossz bázis-URL + token-kulcs is volt). A brain szabálya szerint a 3.
  előfordulásnál érdemes közös wrappert csinálni, ami a bázist + `visoro_token`-t +
  `X-Active-Company`-t mindig ráteszi (érintene: `useAuthedFileUrl`, `ReportModal`,
  vsz. `ProjectFilesSection`). **Robert döntésére vár** — nem építettem be (Simplicity
  §3 + külön, több fájlos meló). Lásd brain `2026-06-04-monthly-report-load-failed`.

---

## Blocked

### `[!]` Bug (Robert): egyes feladatok nem nyithatók meg ("Sarcina nu există sau nu ai acces...")
- **Hozzáadva:** 2026-06-08 · **Bejelentő:** Robert (master admin)
- **Tünet:** a feladat-panel "Sarcina nu poate fi deschisă" hibát mutat (404 `task_not_yours`).
- **Eddig:** a megnyitás-kód (GET /tasks/:id, getTaskById) a mai munkában ÉRINTETLEN; a 404 azt
  jelenti: a feladat nincs az aktív cégben VAGY törölve lett. A most láthatóvá tett feladatok
  (500-limit + "besorolás nélkül") mind aktív-cég-szűrtek → nyílniuk kell, tehát valószínűleg
  meglévő helyzet (stale lista cégváltás után, vagy időközben törölt "ghost" feladat).
- **Blokkolva:** reprodukció hiányában. Kell: melyik feladat / honnan nyitva / cégváltás után-e /
  a Reîncearcă megoldja-e. Lásd brain `2026-06-08-drawer-drag-close-and-open-404`.

---

## Done

### `[x]` UX: notifications olvasott/olvasatlan + Dashboard „lenyugtatás"
- **Hozzáadva / kész:** 2026-06-08
- **Commit:** b29fd17 (+ cf2bd08 finomítás: élesebb olvasott/olvasatlan, keret nélküli cég-jelölő,
  középre zárt keskeny Dashboard; + e8dcb74: notifications „Necitite"/„Citite" szekciókra bontva;
  + eaea25a: „Create de mine" felelős-chip + „Toate pe utilizator" kiemelt user-fejléc avatarral)
  · **PRP:** PRPs/002-ux-calm-dashboard-and-notifications.md
- **Megjegyzés:** Robert UX-visszajelzése, 4 mockup-körrel hangolva. **Notifications:** nevesített
  cég-pill minden soron (a szín olvasotton is megmarad) + kék olvasatlan-jel (bal csík + félkövér +
  pötty) + olvasatlan-számláló + „Doar necitite" szűrő. **Dashboard:** tiszta flex-sorok (státusz-csík
  + cím + halvány „részleg · poszt" + dátum a cím mellett + a meglévő InlineStatusPill mint
  státusz-vezérlő); a nehéz szekciók („Create de mine", „Toate pe utilizator") alapból összecsukva;
  szelíd „În Atenție" panel; több levegő. Lásd brain `2026-06-08-ux-notifications-dashboard`.
- **Ellenőrzés:** kliens `tsc -b && vite build` zöld; lint csak pre-existing. Élő vizuális teszt Robertnél.

### `[x]` Bug (Robert): a feladat-panel bezárult komment-szöveg kijelölésekor
- **Hozzáadva / kész:** 2026-06-08
- **Commit:** 64cb532
- **Megjegyzés:** A TaskDrawer háttere `onClick={onClose}`-zal záródott; ha a komment szövegét
  húzással jelölted ki és az egér a panelen kívül engedett fel, a kattintás a háttérre esett →
  bezárt a panel (mögötte a dashboard). Javítva: `onMouseDown` + `e.target === e.currentTarget`
  őr, így csak a háttéren INDULÓ lenyomás zár. Pre-existing bug, nem a task-lista változás okozta.
  Lásd brain `2026-06-08-drawer-drag-close-and-open-404`.
- **Ellenőrzés:** kliens build zöld; élő teszt Robertnél.

### `[x]` Bug (Emo): "Sarcinile mele" kettéválasztása (Nálam / Általam) + rejtett taskok láthatóvá tétele
- **Hozzáadva / kész:** 2026-06-08
- **Commit:** 21eab7a · **PRP:** PRPs/001-task-list-visibility-fixes.md
- **Megjegyzés:** Bug 1 — a "Sarcinile mele" szűrő "érintett vagyok" (created OR assigned OR
  subtask) helyett két szigorú szűrőre vált: **Atribuite mie** (assigned_to=én) és **Create de
  mine** (created_by=én). Backend `assigned_to_me`/`created_by_me` query-paraméterek; a `my_tasks`
  (dashboard használja) érintetlen. Bug 2 (Visoro Global, 'full') — a lista 50→500 limit, és a
  szervezeti nézetbe bekerült egy "Fără atribuire organizatorică" csoport a poszt/szekció/részleg
  besorolás nélküli taskoknak (eddig láthatatlanok voltak, bár a kereső megtalálta őket). Lásd brain
  `2026-06-08-task-list-visibility-fixes`.
- **Ellenőrzés:** kliens `tsc -b && vite build` zöld, szerver `tsc` zöld; lint csak pre-existing.
  Élő, nem-admin vizuális teszt Robertnél (Visoro Global) folyamatban.

### `[x]` Napi/heti nézet + havi riport megnyitva minden belépett usernek
- **Hozzáadva / kész:** 2026-06-05
- **Commit:** 8dfd746
- **Megjegyzés:** Backend `requireRole('user')` a dayView 3 végpontján + a
  reports/monthly-n; frontend route/menü/riport-gomb feloldva (mindkét sablonnál).
  A "mindenki lássa a mindenkiet" már az adat-rétegben megvolt (cég-szintű, `company_id`-szűrt) —
  csak a hozzáférési gátakat vettem le; tenant-izoláció érintetlen. Lásd brain
  `2026-06-05-open-day-week-monthly-views`.
- **Ellenőrzés:** code review + szerver/kliens production build zöld (élesen ez fut).
  Élő, sima-user vizuális ellenőrzés nem készült el (nem-admin belépés kellene; lásd brain gotcha).

### `[x]` Lezáráskor a státusz + összesítő email egybeolvasztása
- **Hozzáadva / kész:** 2026-06-04
- **Commit:** d324fcf
- **Megjegyzés:** `terminat`-nál már nincs külön `status_changed` email; egy merged
  `completion_report` megy a stakeholderek ∪ riport-címzettek uniójának (dedup),
  a státusz-banner az összesítő tetején. Robert B opciója. Lásd brain
  `2026-06-04-merge-completion-emails`.

### `[x]` Havi riport "Load failed" javítása
- **Hozzáadva / kész:** 2026-06-04
- **Commit:** 0d6f46e
- **Megjegyzés:** A `ReportModal.tsx` nyers fetch-e élesben localhost-ra mutatott
  (`VITE_API_URL` unset) → "Load failed". Relatív `/api` bázis + helyes `visoro_token`
  kulcs + `X-Active-Company` header. Lásd brain `2026-06-04-monthly-report-load-failed`.

### `[x]` Angol nyelv kivétele a választható nyelvek közül
- **Hozzáadva / kész:** 2026-05-29 / 2026-05-30
- **Megjegyzés:** Az `en` opció eltávolítva a cég-nyelv választóból
  (`CompaniesAdminPage.tsx`, `LANGUAGE_OPTIONS` — ez volt az egyetlen hely, ahol
  nyelvet lehet választani). A `CompanyLanguage` típus és az `en.json` szándékosan
  érintetlen: így a meglévő (ha van) `language='en'` cégek továbbra is működnek
  RO-fallbackkel — nincs migráció, nincs DB-művelet. Csak akkor jön vissza, ha
  teljes EN fordítás készül. Lásd PLANNING.md §8.

### `[x]` Projekt alapfájlok felépítése a meglévő kódból
- **Hozzáadva / kész:** 2026-05-29
- **Megjegyzés:** `PLANNING.md`, `TASK.md`, `examples/README.md`, `PRPs/README.md`
  felépítve a futó kódból (nem interjúval). Robert átnézte és jóváhagyta.

### `[x]` PROJECT.md elavultnak jelölése
- **Hozzáadva / kész:** 2026-05-29
- **Megjegyzés:** Megtartva történeti rekordként, a tetejére "ELAVULT" sáv került.
  A PLANNING.md a hivatalos forrás. (Robert rám bízta a döntést.)

### `[x]` Csatolmány megnézés/letöltés cross-tenant 404 fix + PDF-előnézet hiba-ág
- **Hozzáadva / kész:** 2026-05-29
- **Commit:** ca3e891
- **Megjegyzés:** A raw fájl-fetch kihagyta az `X-Active-Company` headert,
  ezért multi-céges usernél a nem-első cég csatolmánya 404-elt. Plusz a
  PDF-előnézet most hibát mutat a végtelen "Betöltés..." helyett.

---

## Cancelled

### `[-]` Payments / Financiar modul
- **Megjegyzés:** A 2026-03 verzióban létezett (route + dashboard), a kódból
  eltávolították. A törlés oka nincs dokumentálva — lásd PLANNING.md Nyitott
  kérdések. Itt csak a tény rögzítve, hogy a jövő ne keresse hiába.
