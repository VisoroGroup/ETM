# PRPs/ — Product Requirements Prompts

A `CLAUDE.md` 8. szekciója szerint: minden olyan feature-höz, ami
egynél több fájlt érint, **a kód előtt** PRP-t kell írni.

## Mi a PRP

Egy strukturált dokumentum, ami megmondja a Claude Code-nak (vagy
egy fejlesztőnek), pontosan mit kell megépíteni, milyen kontextusban,
milyen lépésekben, és hogyan ellenőrizzük, hogy kész.

## Mikor írunk PRP-t

**Igen:**
- Ha a feature több fájlt érint
- Ha új komponens, szolgáltatás vagy alrendszer kerül be
- Ha a "kész" feltételek nem nyilvánvalóak a címből

**Nem:**
- Egyetlen fájl módosítása
- Tipográfiai javítás, egysoros bug fix

Kétség esetén: írunk. 10 perc most, órák megspórolása később.

## Elnevezés

`PRPs/NNN-[feature-slug].md`, ahol `NNN` 3 jegyű sorszám
(`001`, `002`, ...). A sorszámot ne rendezzük át — történeti.

## Életciklus

1. **Draft** — Robert vagy Claude megírja
2. **Approved** — Robert jóváhagyja, dátummal
3. **In progress** — épül
4. **Done** — kész, marad a mappában történeti rekordként
5. **Superseded** — ha későbbi PRP felváltja, ne töröld, csak jelöld

## Index
| # | Cím | Státusz | Indítva | Kész |
|---|-----|---------|---------|------|
| 005 | [Dashboard nézet-módok (választható, mentett)](005-dashboard-view-modes.md) | Done | 2026-06-24 | 2026-06-24 |
| 004 | [Heti és havi tervező](004-weekly-monthly-planner.md) | Done | 2026-06-22 | 2026-06-22 |
| 003 | [Email-link navigáció + lista-megbízhatóság](003-email-link-navigation-and-list-reliability.md) | Done | 2026-06-12 | 2026-06-12 |
| 002 | [UX: nyugodt Dashboard + notifications](002-ux-calm-dashboard-and-notifications.md) | Done | 2026-06-08 | 2026-06-08 |
| 001 | [Feladatlista láthatósági javítások](001-task-list-visibility-fixes.md) | Done | 2026-06-08 | 2026-06-08 |
