# 2026-05-26 — Dashboard "În Atenție" banner stale after alert add/resolve

**Tags:** dashboard, alerts, react-state, ui
**Commit:** 94b8506
**Related:** [[2026-05-26-email-link-tenant-and-tab-handoff]], [[2026-05-26-email-i18n-superadmin-fix]]

## Mit kért

Robert a "NEOPLAN: bankszamla + capital social" feladaton bekapcsolta az "În Atenție" alertet (a task drawer-en belül), de a Dashboard tetején lévő "În Atenție — 4 alerte active" bannerben nem jelent meg. Az új alert nem volt látható, csak a régiek (7 napos, 1 hónapos, 2 hónapos régi alertek).

## Mit változott

- [client/src/components/tasks/tabs/AlertsTab.tsx](client/src/components/tasks/tabs/AlertsTab.tsx) — új opcionális `onUpdate` prop. Az add/resolve/delete műveletek után meghívja az `onReload`-on felül.
- [client/src/components/tasks/TaskDrawer.tsx:609](client/src/components/tasks/TaskDrawer.tsx) — átadja a saját `onUpdate`-jét az AlertsTab-nak (eddig csak `onReload` ment, így a parent sosem értesült alert-változásról).
- [client/src/components/dashboard/DashboardPage.tsx:636-654](client/src/components/dashboard/DashboardPage.tsx) — a drawer `onUpdate` callback-jében mostantól a `dashboardApi.activeAlerts()`-et is újra-fetcheli + frissíti az `activeAlerts` state-et.

## Miért — döntések

**A bug felépítése:** A Dashboard `loadDashboard` useEffect-je csak `[activeCompany?.id, isOverseer]` deps-szel fut le újra. Ha valami megváltozik a task drawer-en belül (alert hozzáadás, resolve, törlés), a Dashboard kapja az `onUpdate`-et, és csak a `tasks` listát fetcheli újra — az `activeAlerts`-et NEM. Eredmény: a banner stale-en marad.

A többi tabnak (Subtasks, Files, Checklist) jól van bedrótozva az `onUpdate` — csak az AlertsTab-nál hiányzott. Ez egy klasszikus mintaeltérés volt.

**Miért nem polling?** Mert a Dashboard egy SPA-oldal, és Robert konkrét akciójára kell reagálni — nem érdemes másodpercenként újrakérni az alerteket csak azért, hogy 0.5% eséllyel megfogjunk egy változást. A callback-alapú értesítés instant és olcsó.

**Miért nem WebSocket / BroadcastChannel?** Ugyanaz a komponens-fa (Dashboard → TaskDrawer → AlertsTab). React props-on át átszól a callback. Ez a legegyszerűbb megoldás a szintén megjeleníthető komplexebbekkel szemben.

## Gotcha jövő-Claude-nak

- **TaskDrawer minden tab-jának kell `onUpdate`** ha valami parent-szintű aggregát view-ra hatással van. Mintaként nézd meg a SubtasksTab-ot és a FilesTab-ot — ezek már ezt csinálják. Ha új tab-ot adsz hozzá és parent-szintű counter-ekre, banner-ekre, listákra hat, **kötelező** átadni az `onUpdate`-et és meghívni mutáció után.
- A Dashboard `onUpdate`-je most két dolgot tölt újra: tasks listát + activeAlerts listát. Ha egy harmadik aggregát view-t adsz hozzá (pl. "stats" számkártyák), ott is hívd `dashboardApi.stats()`-et.
- Az `activeAlerts` query a `dashboard.ts:173-198`-ban van — multi-tenant gated (`a.company_id = $1 AND t.company_id = $1`). Ha az alert helyesen szerepel a DB-ben, de mégsem jelenik meg, ellenőrizd: (a) ugyanaz a company_id-e? (b) `is_resolved = false`-e? (c) `t.status != 'terminat'`-e? — minden befejezett feladat alertje rejtve van.
- A Dashboard onUpdate hívása **nem garantált** minden taskdrawer-művelet után — pl. ha egy gyorsbillentyűvel valaki közvetlenül a backend-en módosít (pl. szerver-oldali job). Akkor a banner stale marad amíg a user át nem kapcsol cégre vagy újra nem tölti a Dashboard-ot.

## Hivatkozások

- Commit: 94b8506 (May 26, 2026).
- Aktív alertek query: [server/src/routes/dashboard.ts:173-198](server/src/routes/dashboard.ts).
- Minta tab onUpdate átadásra: SubtasksTab a TaskDrawer.tsx:597-ben.
