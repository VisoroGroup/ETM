# 2026-06-08 — UX: notifications olvasott/olvasatlan + Dashboard „lenyugtatás"

**Tags:** ux, dashboard, notifications, frontend, design
**Commit:** b29fd17
**Related:** PRPs/002-ux-calm-dashboard-and-notifications.md, [[2026-06-08-task-list-visibility-fixes]]

## Mit kért

Robert UX-panasz (nem bug): az app — főleg a **Dashboard** és a **notifications** —
túl zajos, egybefolyik, nincs hierarchia, fárasztó megtalálni bármit. A
notificationsnál külön: nem látszik, melyik olvasatlan/olvasott, és **a cég-színek
maradjanak meg** (minden cégnek más színe). Robert a Dashboardnál a „nyugtassuk le"
irányt választotta (nem teljes újratervezés), majd kérte a **sorok** rendezését is
és a **státusz-állítást** a soron, plusz a dátum ne essen ki a jobb szélre.

## Mit változott

- [client/src/components/notifications/NotificationBell.tsx](client/src/components/notifications/NotificationBell.tsx)
  - `companyTintStyle` (cég-szín bal csík + tint, ami olvasott/olvasatlanra is rákerült) →
    **`companyPill`**: nevesített címke (szín-pötty + `sidebar_name`) minden soron, olvasotton is.
  - Olvasott/olvasatlan külön csatorna: **olvasatlan** = kék bal csík + félkövér + kék pötty +
    halvány kék háttér; **olvasott** = `opacity-60`, tompított. (Single + grouped + expanded sorok.)
  - Fejléc: olvasatlan-számláló (`count` + `notif.new_short`) + **„Doar necitite"** szűrő
    (`onlyUnread` → `displayed = grouped.filter(hasUnread)`).
- [client/src/components/dashboard/DashboardPage.tsx](client/src/components/dashboard/DashboardPage.tsx)
  - **`renderTaskRow` táblából flex-divre** írva: bal **státusz-csík** (`borderLeft` a státusz
    színe), cím nagyban + halvány **„részleg · szekció · poszt/felelős"** alsor (a régi külön
    oszlopok helyett), **dátum a cím mellett** (`w-[104px]`, nem a jobb szélen), és a meglévő
    **`InlineStatusPill`** mint kattintható státusz-vezérlő (stopPropagation, hogy ne nyissa a drawert).
  - Mivel a sor már `<div>`, a `renderTaskSection` ÉS a per-user blokk **tábláit is divre** váltottam.
  - **Szekció-szintű összecsukás**: a fejlécek gombok; `collapsedStatuses` most `sect_<key>` kulcsokat
    is tárol; **alapból zárva**: `sect_created` (Create de mine) és `sect_all_by_user` (Toate pe utilizator).
  - **Szelíd „În Atenție" panel**: villogó/izzó keret + pingelő pötty kivéve; visszafogott piros bal
    csíkos kártya. Több térköz (`space-y-5 md:space-y-7`).
  - A `COL` szélesség-konstans és a thead-ek törölve (a flex sor nem használja).
- i18n: `notif.only_unread`, `notif.new_short` RO+HU (en.json nem — RO-fallback).

## Miért — döntések

**1. Mockup-vezérelt, 4 körben.** Statikus HTML mockupot építettem (`ux-mockup.html`),
amit a böngészőben nyitottam meg Robertnek (`open` paranccsal) — mert a Claude-preview
**screenshot nálam látszik, Robertnél NEM**. v1→v4: v2 hozta a cég-színeket, v3 a két
pötty szétválasztását (kék olvasatlan külön a cég-pilltől) + interaktivitást, v4 a dátum
behúzását + a státusz-vezérlőt. Robert: „brutál jó irány".

**2. Cég-szín és olvasatlan-jel KÜLÖN csatorna.** A korábbi baj: a bal csík a CÉG színe volt,
ezért minden soron ott volt → nem látszott mi az új. Megoldás: cég = **nevesített pill**
(szín + név), olvasatlan = **kék** (egységes, nem cég-szín; a kék szabad — egyik cég sem kék).

**3. A státusz-vezérlő = a MEGLÉVŐ `InlineStatusPill`.** A mockupban kivettem a „badge"-et,
de Robert jelezte, hogy ott kell tudni állítani — a valódi appban az `InlineStatusPill` EZ.
Csak a körülötte lévő sort tisztítottam (kiesett a redundáns státusz-pötty + a 6 oszlop).

**4. Dátum a cím mellett.** Flex sor: cím `flex-1 min-w-0 max-w-[560px]`, utána fix dátum +
státusz; a maradék jobb oldal üres (levegő). Így a dátum a tartalomhoz tapad, nem a szélre.

## Gotcha jövő-Claude-nak

- **A Dashboard sorai már NEM `<table>`/`<tr>`, hanem flex `<div>`-ek.** A `renderTaskRow`
  flex divet ad vissza → a `renderTaskSection` és a per-user blokk táblái is divek lettek.
  Ne tedd vissza táblába (a `renderTaskRow`-t tbody-ba rakni invalid DOM).
- **`collapsedStatuses` most 3 szint kulcsait keveri**: `sect_*` (szekció), `<sectionKey>_<status>`
  (státusz-csoport), `user_*` / `user_*_status` (per-user). Alapból zárt: `sect_created`,
  `sect_all_by_user`. A nyitás nem perzisztens (session-állapot) — újratöltéskor megint zárva
  nyit a két nehéz szekció (PRP 002 out-of-scope; ha kell, userPreferences, mint a TaskListPage).
- **Notifications olvasatlan-jel = KÉK, szándékosan nem cég-szín.** A cég a `companyPill`
  (`sidebar_name` + color). Ha „miért kék?" merül fel: hogy ne keveredjen a cég-színnel.
- **A `count` (szerver unread-szám) hajtja a fejléc-számlálót**; a `markRead`/`markAllRead`
  lokálisan csökkenti. A „Doar necitite" csak a `hasUnread` csoportokat mutatja.
- **Pre-existing eslint debt érintetlen** (getDueDateStatus/ChevronDown/charts unused, `any`,
  üres `catch {}` — pl. a 422-es az alert-feloldó gomb meglévő kódja). A build a kapu (zöld).
- **`ux-mockup.html` a repo gyökerében untracked maradt** (eldobható mockup; nem commitoltam).
  Töröld, ha zavar: `rm ux-mockup.html`.
- **Élő vizuális teszt Robertnél** — a mockup ≈ a valódi app, de nem 1:1; ha élesben valami
  csúszik (sor-térköz, InlineStatusPill szélesség, meta-sor hossz), ott finomíts.

## Frissítés — 2. kör (cf2bd08, élő visszajelzés)

Robert élesben: az olvasott/olvasatlan MÉG MINDIG nem volt elég éles, a keretes cég-pill
csúnya; a Dashboard lista az egész szélességet elfoglalta, de az infók balra lógtak.
- **Notifications:** `companyPill` (keretes) → **`companyChip`** (keret nélküli színes pötty +
  név; a név a cég színében olvasatlannál, szürke olvasottnál). Kontraszt élesítve: az
  `opacity-60` (fakó, csúnya) helyett az olvasott **lapos + szürke szöveg**; az olvasatlan
  **erősebb kék háttér (0.1) + kék bal csík (blue-400) + félkövér fehér**. `hexToRgba` törölve.
- **Dashboard:** outer konténer `max-w-full` → **`max-w-[1040px] mx-auto`** (középre zárt,
  keskenyebb oszlop); a sor címe kitölti az oszlopot, a dátum/státusz az oszlop jobb szélén
  (nem a képernyő szélén). Robert: „keskenyebb ablak középen, kompaktan egy helyen".

## Frissítés — 3. kör (e8dcb74)

Robert: válasszuk **fizikailag külön**. A notifications mostantól **két szekció**: fent
**„Necitite"** fejléc + olvasatlan csoportok, majd felső elválasztóval **„Citite"** fejléc +
(halvány) olvasott csoportok. Index-alapú fejléc-beszúrás a `displayed.map`-ben (az
olvasatlan→olvasott határnál + a lista elején), a sor-body változatlan, `React.Fragment`-be
csomagolva a kulcsokkal. A „Doar necitite" szűrő továbbra is elrejti az olvasott szekciót.
i18n: `notif.section_unread`, `notif.section_read` (RO Necitite/Citite, HU Olvasatlan/Olvasott).

## Hivatkozások

- Commit: b29fd17 (`feat(ux): clarify notifications read/unread + calm and clean the dashboard`); cf2bd08 (finomítás); e8dcb74 (Necitite/Citite szekciók).
- PRP: PRPs/002-ux-calm-dashboard-and-notifications.md.
- Érintett: `InlineStatusPill` (tasks/InlineStatusPill.tsx) — a státusz-vezérlő.
- Ugyanennek a napnak a többi munkája: [[2026-06-08-task-list-visibility-fixes]], [[2026-06-08-drawer-drag-close-and-open-404]].
