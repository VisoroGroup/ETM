# 2026-07-07 — "Noutăți" felugró + kürt ikon (PRP 008)

**Tags:** whatsnew, ux, layout, notifications, i18n, preferences, workflow
**Commit:** be27903
**Related:** PRPs/008-whats-new-popup.md, brain/2026-06-24-dashboard-view-modes.md (a merge-patch pref-minta forrása)

## Mit kért
Robert: minden Sarcinator-frissítés után egyszeri automatikus felugró az
újdonságokkal (kép + leírás), OK után eltűnjön; a fejlécben kürt (megafon)
ikon piros jelzéssel, kattintásra bármikor újra megnyitható — és mindez
minden jövőbeli frissítésnél magától történjen.

## Mit változott
- `client/src/whatsnew/releases.ts` — a kiadás-lista a kódban verziózva
  (id, dátum, RO+HU cím/leírás, opcionális kép `/release-notes/`-ból).
  Első bejegyzés: org struktúra + rekurens esedékesség + stat-kártya
  felugrók + blocat≠lejárt.
- `client/src/whatsnew/WhatsNewModal.tsx` — modál a StatTasksModal
  mintájára (z-[80], slide-up, Esc/backdrop/OK zárás, autoFocus az OK-n).
- `client/src/components/layout/Layout.tsx` — Megaphone gomb 3 helyen
  (kinyitott sidebar fejléc a harang mellett; összecsukott sidebarnál külön
  sor a logó alatt; mobil topbar), piros pont-badge, auto-open logika.
- i18n: `whatsnew.*` kulcsok ro/hu (en RO-ra fallbackel).
- `CLAUDE.md` — 7. § új anchor + 9. § új tiltás (10.): user-facing push
  KÖTELEZŐEN ad release-bejegyzést a releases.ts-be, ugyanabban a pushban.

## Miért — döntések
- **Tartalom a kódban, nincs admin UI és nincs DB** — a session írja a
  bejegyzést a feature-rel együtt; a látta-jelzés a meglévő
  `user_preferences` JSONB merge-patch-be megy (`whats_new_seen` = utolsó
  látott release id). Nulla szerver-változás, nulla migráció.
- **Új user (nincs marker):** csak a legutóbbi kiadást kapja meg
  (seen = LATEST-1 defaulttal), nem a teljes történetet.
- **Kürtre kattintva:** ha van nem látott → csak azokat mutatja; ha minden
  látott → a 3 legutóbbi kiadást. Bezárás mindig LATEST-re állítja a markert.
- **Nyelv:** a release-szöveg cégnyelv szerint (hu → hu, minden más → ro),
  a `pickText` helperrel — az i18n kulcsok csak a keretszövegek.

## Gotcha jövő-Claude-nak
- **ÚJ KÖTELEZETTSÉG:** minden user-facing push előtt új entry a
  `releases.ts` TETEJÉRE (id = eddigi legnagyobb + 1, RO+HU). Ha kihagyod,
  a CLAUDE.md 9.10 tiltást sérted.
- Kép: `client/public/release-notes/` alá, `/release-notes/x.png`-ként
  hivatkozva; opcionális, a modál kép nélkül is jól néz ki.
- A Layout.tsx-ben pre-existing lint hiba él (`icon: any`, ~23. sor,
  NavItem típus) — nem ehhez a featurehöz tartozik, szándékosan maradt.
- A modál z-[80] (a mobil bottom-nav z-50 és a sidebar z-40 felett, a
  logout-confirmmal azonos szinten).

## Hivatkozások
- PRPs/008-whats-new-popup.md
- client/src/components/dashboard/StatTasksModal.tsx (modál-minta)
- server/src/routes/userPreferences.ts (merge-patch PUT — változatlan)
