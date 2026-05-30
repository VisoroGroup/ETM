# 2026-05-29 — Projekt alapfájlok felépítése + governance döntések

**Tags:** planning, governance, i18n, docs, setup
**Commit:** dd8ba60
**Related:** [[2026-05-29-attachment-tenant-header]]

## Mit kért

Ugyanabban a sessionben, miután a csatolmány-bug ki lett javítva, Robert:
"ezeket mind csinald meg" — köztük a hiányzó alapfájlok (`PLANNING.md`,
`TASK.md`, `examples/`, `PRPs/`) felépítése. A `brain/` már korábban
bootstrapelve volt, de a többi anchor sosem készült el.

## Mit változott

- **`PLANNING.md`** (új) — a futó kódból rekonstruált aktuális architektúra,
  tech stack, multi-tenant adatáramlás, korlátok. Nem interjúval, mert az ETM
  már érett production rendszer.
- **`TASK.md`** (új) — Active/Backlog/Done/Cancelled valós állapottal.
- **`examples/README.md`, `PRPs/README.md`** (új) — statikus útmutatók az
  AGENTS.md sablonból, üres indexszel.
- **`PROJECT.md`** — a tetejére "ELAVULT" sáv került; megtartva történeti
  rekordként, de már nem aktuális forrás.

## Miért — döntések

**1. Miért kódból építettük az anchorokat, nem az AGENTS.md interjúval?** Az
AGENTS.md first-run protokollja egy zöldmezős projektre van kitalálva, ahol
Robert leírja, mit akar. Itt a "ground truth" maga a futó, éles kód (070+
multi-tenant migrációk, i18n, magic-link, PUG) — ezt rekonstruálni pontosabb,
mint 15 kérdést feltenni egy kész rendszerről. Robert ezt jóváhagyta.

**2. A három üzleti döntés (Robert, 2026-05-29):**
- **Payments/Financiar modul:** véglegesen eltávolítva. A 2026-03 PROJECT.md-ben
  még volt route + dashboard; ellenőriztem, ma se route, se komponens. Nem tér vissza.
- **PROJECT.md:** megtartva történeti rekordként (a 2026 márciusi munka egyetlen
  rendezett naplója, a brain/ előtti korszakból), de "ELAVULT" sávval. Törölni
  kár lett volna a történetért; a sáv kizárja, hogy egy jövő-session aktuálisként olvassa.
- **EN locale:** az angol **nem támogatott nyelv**. Mért adat: `ro`=1001,
  `hu`=1001, `en`=**93** lefordított string (~9%); 47 szekcióból 39 teljesen
  hiányzik EN-ből. Mivel a hiányzó kulcs RO-ra fallbackel, az angolra állított
  felület ~91%-a románul jelenne meg. Senki nem használja → kivesszük a
  nyelvválasztóból (külön task), nem fordítjuk le.

**3. Push-gate lecke:** az alapfájlok első commit+push kísérletét az auto-mode
classifier **blokkolta**, mert az AGENTS.md/CLAUDE.md előírja, hogy Robert
nézze át a setup-fájlokat (főleg PLANNING.md) push előtt. A blokk helyes volt.
A push csak azután ment át, hogy Robert ténylegesen átnézte és jóváhagyta.

## Gotcha jövő-Claude-nak

- **A `PLANNING.md` a hivatalos forrás, NEM a `PROJECT.md`.** Ha a PROJECT.md-ben
  látsz valamit (payments, régi roadmap, env-lista, tábla-lista), az nagy
  eséllyel elavult — a PLANNING.md-t és a brain/-t hidd el. A PROJECT.md
  tetején ott a sáv.
- **Ne próbálj frissen generált PLANNING.md-t auto-pusholni.** A setup-fájlok
  review-gate alá esnek (AGENTS.md 6. lépés) — előbb mutasd meg Robertnek
  szekciónként, és csak a jóváhagyása után pushold. A classifier amúgy is blokkolja.
- **Angol nyelv:** ha valaki felveti "miért nincs angol / adjak hozzá EN
  fordítást?", a válasz: tudatos döntés, hogy nincs (2026-05-29). Csak akkor
  fordítsd le, ha Robert konkrét angol felhasználói igényt jelez. Addig az EN-t
  ki kell venni a választóból (TASK.md backlog) — előtte ellenőrizd, van-e cég
  `language='en'`-re állítva a DB-ben.

## Hivatkozások

- Commit: dd8ba60 (anchors + PROJECT.md banner).
- `PLANNING.md` 8. szekció — a három eldöntött kérdés rögzítve.
- `TASK.md` Backlog — "Angol nyelv kivétele" task.
- Ugyanennek a sessionnek a másik fele: [[2026-05-29-attachment-tenant-header]].
