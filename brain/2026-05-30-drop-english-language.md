# 2026-05-30 — Angol nyelv kivétele a cég-nyelv választóból

**Tags:** i18n, multitenancy, frontend, ux, communication
**Commit:** 9a2f116
**Related:** [[2026-05-29-project-anchors-bootstrap]], PLANNING.md §8, TASK.md (Done)

## Mit kért

A 2026-05-29-i döntés (EN nem támogatott nyelv, ~9% lefordítva) implementálása.
Robert megerősítette: "senki sem hasznalja angolul". Fontos kontextus: a kérdést
úgy tettem fel neki, hogy közben **technikai feladatot** akartam rátolni (futtass
egy SQL-t, hány céged van) — erre jogosan rászólt: "nem ertem mit akarsz, mint
tudod nem vagyok tachnikai ember". A tényleges kérés tehát: **vedd ki az angolt,
és ne terhelj technikai kérdésekkel.**

## Mit változott

- **`client/src/components/admin/CompaniesAdminPage.tsx`** — a `LANGUAGE_OPTIONS`
  tömbből kivéve az `{ value: 'en', ... }` sor (ez volt az **egyetlen** hely az
  egész appban, ahol cég-nyelvet lehet választani: a `<select>` ~392. sor, és a
  161. sor label-lookup, aminek `?? c.language` fallbackje van). 4 soros komment
  magyarázza, miért nincs angol, és mikor jöhet vissza.
- **`TASK.md`** — a feladat Backlog → Done.

## Miért — döntések

**1. Csak frontend, semmi DB / migráció / típus-változás.** A `CompanyLanguage`
típus (`'ro'|'hu'|'en'`) és az `en.json` **szándékosan érintetlen**. Ezért a
változás biztonságos **függetlenül attól, van-e bárhol `language='en'` cég**: ha
van, az tovább működik RO-fallbackkel, csak a szerkesztő-űrlapon nem lehet újra
kiválasztani az angolt. Így nem kellett a prod DB-hez nyúlni, se migráció.

**2. Ez korrigálja a tegnapi gotchát.** A `2026-05-29-project-anchors-bootstrap`
entry azt írta: "előbb ellenőrizd, van-e cég `language='en'`-re állítva a DB-ben".
**Ez a lépés végül NEM volt szükséges** — a fenti #1 miatt a kód-only megoldás
minden DB-állapot mellett helyes. A DB-ellenőrzés csak akkor kéne, ha a típusból
is kivennénk az `en`-t (az törné a meglévő sorokat) — de azt nem tettük.

**3. Miért nem vettük ki a típusból / `en.json`-ból is?** Simplicity (CLAUDE.md
§3) + Surgical (§4): a választó az egyetlen belépési pont; ennek kivétele megoldja
a feladatot. A típus/locale szűkítése extra rizikó (meglévő sorok, fallback-lánc)
nulla haszonért. Ha valaha teljes EN fordítás készül, csak vissza kell tenni egy
sort.

## Gotcha jövő-Claude-nak

- **Robert nem technikai — soha ne tolj rá technikai vagy adat-lekérdezős
  kérdést** ("futtasd ezt az SQL-t", "hány X van a DB-ben") a döntéshez. Ha egy
  döntéshez adat kell, **szerezd meg magad** (kód, DB-olvasás MCP-vel, stb.), vagy
  találj olyan megoldást, ami az adattól függetlenül helyes. A kérdés felé csak
  **üzleti** formában fordulj ("használja-e bárki az angolt?"), és abból is keveset.
- **Az angol kivétele tudatos és kész (2026-05-30).** Ha valaki kéri "tegyük
  vissza az angolt" — az csak teljes EN fordítással van értelme (jelenleg 93/1001
  kulcs). Addig egy sor visszarakása a `LANGUAGE_OPTIONS`-be megint 91%-ban
  románul jelenítené meg az "angol" felületet.
- **A `language_en` i18n-kulcs és az `en.json` szándékosan bent maradt** — ne
  "takarítsd ki" őket, ártalmatlanok és a visszaút részei.

## Hivatkozások

- Commit: 9a2f116 (`fix(i18n): drop English from the company language picker`).
- A döntés eredete: [[2026-05-29-project-anchors-bootstrap]] §"EN locale".
- PLANNING.md §8 (eldöntött kérdések), TASK.md (Done).
