# 2026-05-26 — Email i18n bug + Sarcini accordion + tab reuse

**Tags:** i18n, email, multitenancy, ui, notifications
**Commit:** 01408ce, ddea6e4
**Related:** [[2026-05-19-i18n-hardening-wave]]

## Mit kért

Robert három problémát flagelt:
1. A Sarcini oldalon mindig az első osztály (idx 0) ki van bontva — ezt nem akarja, mindegyik legyen csukva.
2. Az e-mail értesítőkben a "Deschide sarcina" gomb minden klikkre új böngészőfület nyit.
3. **A legsúlyosabb:** a magyar cégeknél (Visoro Hungary, Talajradar) az e-mailek **románul** jönnek, hiába van a `companies.language='hu'` az adott cégnél.

## Mit változott

- [client/src/components/tasks/TaskListPage.tsx:742](client/src/components/tasks/TaskListPage.tsx) — `defaultExpanded={false}` minden osztályra. Az `idx` paraméter már nem kell.
- [client/src/main.tsx:5](client/src/main.tsx) — `window.name = 'sarcinator-app'` az alkalmazás induláskor. Az e-mail-template már most is `target="sarcinator-app"`-pal generálja a linket, így a browser megtalálja a már nyitott ETM fület.
- [server/src/services/notificationEmailService.ts:55-100](server/src/services/notificationEmailService.ts) — a `resolveRecipientLocale` **NEM** JOIN-ol többé `user_companies`-ra. Közvetlenül a `companies.language`-et olvassa, ha `companyId` adott.
- [server/src/services/taskCompletionReportService.ts](server/src/services/taskCompletionReportService.ts) — `status_*` és `action_*` kulcsok hozzáadva HU/RO/EN-re. A státusz- és tevékenységnapló-feliratok már lokalizáltak; a régi hardcoded `actionLabels` objektum eltávolítva.

## Miért — döntések

**Email i18n bug gyökér-oka (FONTOS):** A korábbi SQL ezt csinálta:
```sql
SELECT c.language FROM companies c
JOIN user_companies uc ON uc.company_id = c.id
WHERE uc.user_id = $1 AND c.id = $2
```
A JOIN miatt csak akkor adott vissza nyelvet, ha a címzett tagja a `user_companies` táblának. **Robert (superadmin) és Mária NINCS automatikusan benne minden cég `user_companies` sorában** — superadmin szerepkörként amúgy is mindenhez hozzáférnek. Az `ALWAYS_RECEIVE_EMAILS` lista miatt mégis kapnak e-mailt minden cég feladatáról → 0 sor → default 'ro'. A javítás: drop a JOIN-t, csak a cég nyelvét nézd. Az e-mail nyelve mindig a feladat tenant-jának nyelvével egyezzen, NEM a címzett személyes preferenciájával.

**Tab reuse:** A `target="sarcinator-app"` HTML attribútum csak akkor talál meg egy meglévő fület, ha annak `window.name` is meg van adva. Ha Robert bookmarkkal vagy URL-lel nyitja meg az ETM-et, a fülnek nincs neve. A `window.name = 'sarcinator-app'` beállítása biztosítja, hogy a Gmail-ből érkező linkek az aktuálisan nyitott fület használják.

## Gotcha jövő-Claude-nak

- **`resolveRecipientLocale(userId, companyId)` MOST a cég nyelvét adja vissza, függetlenül attól, hogy a user tagja-e a `user_companies` táblának.** Ne nyúlj hozzá visszafelé! A `user_companies` JOIN azért rossz volt itt, mert superadminok cross-tenant kapnak értesítést.
- A `userIsInCompany` viszont továbbra is `OR u.role IN ('admin','superadmin')` ágat tartalmaz — ez tenant guard-okhoz kell, hogy superadmin minden cégbe írhasson. Két különböző cél, ne keverd.
- A Sarcinator e-mail design `target="sarcinator-app"` névvel hivatkozik a fülre. **Ha bárhol új e-mail template-et írsz**, ugyanezt a célt használd, különben a tab reuse fix nem fog működni rá.
- Gmail néha átírja a linkeket saját `google.com/url?...` redirectre és **stripheti a `target` attribútumot**. Ebben az esetben a tab reuse nem fog működni. Ha Robert még panaszkodik, server-oldali köztes redirect oldal kell `window.open(url, 'sarcinator-app')`-pal.
- Az `OrgDepartmentAccordion` komponens belső `useState(defaultExpanded)`-et használ — `defaultExpanded` csak az init értéke, nem reaktív. Ha runtime-ban toggle-ölni akarsz minden accordiont, controlled mode-ra kell átírni.

## Hivatkozások

- Korábbi kapcsolódó: `b771f7b` (post descriptions HU→RO re-seed), `afbf5da` (notification i18n), [[2026-05-19-i18n-hardening-wave]]
- ALWAYS_RECEIVE_EMAILS lista: [server/src/services/taskCompletionReportService.ts:135](server/src/services/taskCompletionReportService.ts)
- Multi-tenancy guard: [server/src/utils/tenantGuard.ts:12](server/src/utils/tenantGuard.ts)
