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

(nincs aktív feladat)

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

(nincs)

---

## Done

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
