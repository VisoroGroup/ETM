# PRP: "Újdonságok" (What's New) felugró + kürt ikon

## Goal
Minden Sarcinator-frissítés után a belépő felhasználók egyszer automatikusan
kapjanak egy felugrót, ami képekkel/leírással bemutatja az újdonságokat. Az
"OK" gomb után többé nem ugrik fel; a fejlécben egy kürt (megafon) ikon piros
jelzéssel mutatja, ha van még nem látott újdonság, és kattintásra bármikor
újra megnyitja a felugrót.

## Context
- Files to read:
  - `client/src/components/layout/Layout.tsx` (fejléc, NotificationBell helye:
    ~203. sor desktop, ~322. sor mobil)
  - `client/src/components/notifications/NotificationBell.tsx` (piros badge
    minta: 244–248. sor)
  - `client/src/components/dashboard/StatTasksModal.tsx` (modál-minta:
    overlay z-50, animate-slide-up, kattintás-kívülre zárás)
  - `client/src/services/api.ts` (userPreferencesApi: 156–160. sor)
  - `server/src/routes/userPreferences.ts` (JSONB merge-patch PUT — NEM változik)
  - `client/src/i18n/I18nContext.tsx` + `locales/ro.json`, `hu.json`
- Existing patterns to follow:
  - Preferencia-mentés: `userPreferencesApi.save({ kulcs: érték })` —
    merge-patch, nincs migráció, nincs szerver-változás (dashboard_view_mode
    mintája, DashboardPage.tsx 225–228).
  - Badge: NotificationBell piros számos badge-e (bg-red-500, animate-pulse).
  - Ikon: lucide-react `Megaphone`.
- Known gotchas:
  - A nyelv cégenkénti (activeCompany.language), RO-fallbackkel — a release
    tartalom RO + HU szöveggel készül, a megjelenítés a cég nyelvét követi.
  - Képek a `client/public/release-notes/` mappából (`/release-notes/x.png`)
    — bytea-DB szabály nem érinti, ezek build-be csomagolt statikus fájlok.
  - A modál csak bejelentkezett felületen (Layout-ban) jelenhet meg.
  - Új felhasználónál (nincs mentett `whats_new_seen`) csak a LEGUTÓBBI
    kiadás jelenik meg, nem a teljes történet.

## Design
1. **Tartalom-forrás:** új fájl `client/src/whatsnew/releases.ts` — a kiadások
   listája a kóddal együtt verziózva. Egy kiadás: `id` (növekvő szám),
   `date`, és nyelvenkénti (ro/hu) cím + tételek; egy tétel: cím, leírás,
   opcionális kép (`/release-notes/...`). Nincs DB, nincs admin felület.
2. **Látta-követés:** `user_preferences.whats_new_seen` = utolsó látott
   kiadás `id`-ja (felhasználónként, merge-patch).
3. **Automatikus felugró:** a Layout betöltésekor ha `latestId > seen`,
   a modál magától kinyílik; az OK gomb menti a `whats_new_seen = latestId`-t.
   Több kihagyott kiadásnál mind megjelenik (legújabb felül), max 3.
4. **Kürt ikon:** a fejlécben a harang mellett (desktop + mobil), lucide
   `Megaphone`; piros pont-badge ha `latestId > seen`; kattintásra a modál
   bármikor megnyílik (ilyenkor is a legutóbbi kiadásokat mutatja).
5. **Folyamat-szabály (automatizmus):** a CLAUDE.md 7. szekciójába és a
   brain/README-be bekerül: minden user-facing push előtt a session KÖTELES
   új bejegyzést tenni a `releases.ts`-be (RO+HU szöveggel, ha van értelme
   képpel). Így minden jövőbeli frissítésnél magától készül a tartalom.

## Implementation Plan
1. `client/src/whatsnew/releases.ts` — típus + első bejegyzés (a mostani
   org-struktúra + rekurens/stat-kártya frissítésekkel) → verify: build zöld.
2. `client/src/whatsnew/WhatsNewModal.tsx` — modál a StatTasksModal mintájára
   (overlay, slide-up, OK gomb, képek `max-w`-vel) → verify: build zöld.
3. Layout.tsx: kürt ikon + badge + auto-open logika (userPreferencesApi.get
   már betöltéskor fut a Dashboardon — itt saját, egyszeri lekérés a
   Layout-ban, TanStack Query-vel cache-elve) → verify: build zöld.
4. i18n kulcsok (ro/hu): "Noutăți" / "Újdonságok", OK gomb, "Actualizare
   software" fejléc → verify: mindkét locale-ban megvan.
5. CLAUDE.md 7. § + brain/README: release-bejegyzés kötelezettség push előtt.
6. Lint + `tsc -b && vite build` a kliensen → verify: hibátlan.

## Validation Loop
- `cd client && npx tsc -b && npx vite build` — zöld.
- ESLint a változott fájlokra — hibátlan.
- Manuális teszt (Robert, élesben deploy után): belépéskor felugrik az
  "Újdonságok" ablak; OK után eltűnik; újratöltéskor NEM jön vissza; a
  kürt ikonon nincs piros pont; kürtre kattintva újra megnyílik.

## Out of Scope
- Admin felület a kiadás-szövegek szerkesztésére (a tartalom a kódban él,
  a sessionök írják push előtt).
- Automatikus képernyőkép-készítés (kép opcionális, kézzel kerül a
  public/release-notes mappába).
- Szerver-oldali változás, DB-migráció (nincs rá szükség).
- Régi kiadások böngészhető archívuma (a modál a legutóbbi max 3 kiadást
  mutatja).
