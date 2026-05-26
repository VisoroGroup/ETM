# 2026-05-19 — i18n hardening hullám (date-fns + filenames + relative-time)

**Tags:** i18n, dates, file-upload, public-pages
**Commit:** 8b5b52b, 2f64dee
**Related:** [[2026-05-26-email-i18n-superadmin-fix]]

## Mit kért

Robert több kisebb i18n szivárgást észlelt, főleg a magyar cégekben:
- A dátumok angolul / románul jelentek meg, hiába volt magyar a cég nyelve.
- A relative-time formátum ("2 hours ago" / "acum 2 ore") nem váltott magyarra.
- A magyar ékezeteket tartalmazó fájlnevek (pl. "Árlista_május.pdf") feltöltéskor megsérültek.
- A public project page (a megosztható, read-only link) nem követte a cég nyelvét.

## Mit változott

- Az aktív cég nyelve alapján van beállítva a `date-fns` locale (RO/HU/EN). Korábban a `navigator.language`-ből jött, ami félrement.
- A fájlfeltöltési útvonal ékezet-biztos lett (UTF-8 normalization a multer/Express oldalán).
- A relative-time formatterek (pl. "5 perce", "tegnap") szinkronban követik az `activeCompany.language`-et.
- A public share token-es project page lekéri a project tenant-jának nyelvét és úgy renderel.

## Miért — döntések

**A cég nyelve a forrás, NEM a browser locale.** ETM multi-tenant — egy user több cég tagja lehet, és más-más cégben más nyelvet beszél (pl. Robert RO-ban és HU-ban is dolgozik). A frontend ezért **mindig** az `activeCompany.language`-et használja date-fns és i18n locale forrásként, sosem a `navigator.language`-et.

**Public oldalak (token-alapú megosztás):** ezek nincs bejelentkezett user → nincs `activeCompany`. Ehelyett a projekt `company_id`-jából oldjuk fel a nyelvet a szerverrenderkor.

## Gotcha jövő-Claude-nak

- **NE használj `navigator.language`-et SEHOL i18n döntéshez.** Mindig az aktív cég nyelve, vagy publikus oldalon a projekt cégének nyelve.
- A date-fns import-okat `import { format, formatDistance } from 'date-fns'` + külön locale import (`import { hu, ro, enGB } from 'date-fns/locale'`) szokták kérni. Új komponensnél nézd meg, hogy a locale paramétert átadod-e — egyébként default angol lesz.
- A fájlnév-UTF-8 normalization minden új upload-route-on kell. A multer default nem normalizál.

## Hivatkozások

- Notification payload i18n: `afbf5da` (commit, May 17) — strukturált payload, hogy a bell ikon a viewer locale-ját kövesse.
- Korábbi HU-leak: `b771f7b` (commit, May 17) — 5 post description véletlenül magyarul került be a seed-be, vissza-RO-sítva.
