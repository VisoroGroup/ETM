# 2026-05-26 — Email link cross-tenant fix + BroadcastChannel tab handoff

**Tags:** email, multitenancy, frontend, broadcastchannel, ux
**Commit:** 01255e9
**Related:** [[2026-05-26-email-i18n-superadmin-fix]]

## Mit kért

Robert e-mailből megnyitott feladatoknál **404-et** kapott ("A feladat nem található vagy nincs hozzá jogosultságod ebben a cégben") — több taskon is. Emellett az előző commit (ddea6e4) `window.name = 'sarcinator-app'` fix **továbbra is** új fülöket nyitott minden klikkre.

## Mit változott

- [server/src/services/notificationEmailService.ts:114-138](server/src/services/notificationEmailService.ts) — `buildNotificationHtml` új paramétere: `companyId?: number | null`. A generált URL most: `/tasks?openTaskId=<uuid>&companyId=<N>`.
- 7 callsite frissítve (`taskSubtasks.ts`, `taskComments.ts`, `taskChecklist.ts`, `tasks.ts`, `taskService.ts`, `notificationEmailService.ts:notifyStakeholders`). Mindegyik átadja a saját scope-jában lévő `companyId` (vagy `req.activeCompanyId`, vagy `taskCompanyId`) értéket.
- [client/src/components/tasks/TaskListPage.tsx](client/src/components/tasks/TaskListPage.tsx) — az `openTaskId` URL-effekt most a `companyId` paramétert is olvassa, és `setActiveCompany(targetCompanyId)`-t hív a `setSelectedTaskId` ELŐTT. Vár, amíg a `companies` lista betöltődik (a `useCompany` provider aszinkron). Effekt deps bővítve: `[location, companies, activeCompany?.id, setActiveCompany]`.
- [client/src/main.tsx:6-72](client/src/main.tsx) — BroadcastChannel-alapú tab-átadás. Minden ETM fül feliratkozik a `sarcinator-tabs` csatornára. Egy frissen nyitott "email-landing" fül (`/tasks?openTaskId=…` URL-lel) elküld egy `ping` üzenetet → ha bárki válaszol `pong`-gal, az email-landing fül átküldi az `openTaskId+companyId`-t és bezárja magát. Ha 600ms alatt nincs válasz, normál betöltés.

## Miért — döntések

**1. Miért nem elég a `target="sarcinator-app"`?** Mert az asztali e-mail kliensek (Apple Mail, Outlook desktop, Thunderbird) a linket a rendszer-böngészőnek adják át `open URL` rendszerhívással. A `target` attribútum HTML-szintű, csak akkor él, ha a klikk egy böngésző-fülön belül történik. Az e-mail kliens → böngésző átadás közben a `target` info elveszik. Ezért BroadcastChannel kell.

**2. Miért nem hagyom egyszerűen a TaskDrawer-t újrapróbálkozni 404 után?** Mert akkor minden tenant-on végig kellene mennie sorban (próbáld company 1 → 404 → company 2 → …). Ez UX-szempontból csúnya (vibráló loading), és a backend `X-Active-Company` header-rel működik, nem URL-paraméterrel. A `companyId` az URL-ben tisztább.

**3. Miért React `useEffect` és nem egy korai navigáció a router szintjén?** Mert a `companies` lista az auth után, aszinkron töltődik. A router szintjén nem tudnám megvárni. A useEffect deps-be tett `companies` biztosítja, hogy az effekt akkor fusson le újra, amikor a lista megérkezik.

**4. Handoff timeout: 600ms?** Tesztelés alapján reális. Egy létező ETM fül ~50ms alatt válaszol. 600ms biztonsági margó: ha lassú a böngésző (sok fül, alvó tab), akkor sem várunk észrevehetően sokáig — a usernek így is gyorsabb mint a régi 4-tabos állapot.

**5. Miért `window.close()` + `about:blank` fallback?** Mert a `window.close()` csak akkor működik, ha a tabot JS nyitotta (azaz `window.open()` hívással). Az e-mail kliens által nyitott tabokra a böngésző NEM engedi. Ekkor `about:blank`-ra navigálunk — a felhasználó látja, hogy "üres" lett, megnyitja a kérdéses task-ot az eredeti ETM fülben, és kézzel bezárja az üreset. Nem tökéletes, de ez a legtöbb amit a böngésző security model megenged.

## Gotcha jövő-Claude-nak

- **Az e-mail linknek mindig három infót KELL hordoznia:** `openTaskId`, `companyId`, és magát az alap URL-t. Ha új e-mail típust adsz hozzá, **NE** építsd újra kézzel a URL-t — használd a `buildNotificationHtml`-t, ami már mindegyiket kezeli.
- **A `setActiveCompany` szinkron** updateli az `X-Active-Company` header-t (az `api.ts` `setActiveCompanyId(id)` hívása által), tehát a következő API request már az új tenant-be megy. Ezért a TaskDrawer fetch közvetlenül utána biztonságos. NE adj hozzá `await`-eket vagy késleltetést erre — nincs rá szükség.
- **A BroadcastChannel csak ugyanolyan origin-en működik.** Subdomain-en NEM. Ha az ETM-et valamikor `app.visoro.ro` mellé `crm.visoro.ro`-ra is deployolják, a két subdomain közötti tab-handoff nem fog működni — ez OK, mert akkor amúgy is külön app-ok.
- **`isHandoffLandingPage` check:** Csak `/tasks?openTaskId=…` URL-lel induló fülek próbálnak handoff-ot. Ez fontos, mert egyébként pl. egy alap dashboardra navigált új fül is ping-pong üzenetekbe keveredne másik tab-okkal.
- **Robert az Apple Mail-t használja.** Ha valaha is azt látja, hogy mégis új fül nyílik, ellenőrizd: (a) BroadcastChannel API él-e a Safariban (igen, 2022 óta), (b) a vsv kód deployolt-e (Railway latest), (c) van-e másik ETM fül egyáltalán nyitva (ha nincs, akkor a "landing" lesz a fő tab — ez szándékos).

## Hivatkozások

- A nyitó commit: 01255e9 (May 26, 2026).
- Vissza-hivatkozás az i18n bug-ra, ami most ugyanazt az e-mail-rendszert érintette: [[2026-05-26-email-i18n-superadmin-fix]].
- `useCompany` hook: [client/src/hooks/useCompany.tsx](client/src/hooks/useCompany.tsx). A `setActiveCompany` itt definiált.
- `userIsInCompany` superadmin bypass: [server/src/utils/tenantGuard.ts:12](server/src/utils/tenantGuard.ts).
