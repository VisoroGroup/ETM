# PRP: 003 — Email-link navigáció + lista-megbízhatóság (Emo bejelentések köre)

**Státusz:** Approved — 2026-06-12, Robert (beszélgetésben: „csinald meg ezeket", az
5 tételes listára). Draft és approval ugyanazon a napon.

## Goal

Emo két bejelentése nyomán öt javítás. (1) Az emailben kapott task-/komment-link
mindig a taskhoz vigyen — akkor is, ha a kattintáskor lejárt a bejelentkezés
(a belépés után térjünk vissza az eredeti linkre, ne a főoldalra). (2) Ha az app
már nyitva van egy másik fülön, a link ne egy üres lapot hagyjon maga után —
a task helyben nyíljon meg. (3) Komment-értesítő linkje a konkrét kommenthez
görgessen. (4) A task-lista két szűrőgombjának gyors váltogatásánál ne
ragadhasson be elavult találati lista (válasz-sorrend védelem). (5) Deploy után
a böngészőben ragadt régi verzió ne hibaüzenetet adjon, hanem egyszer magától
újratöltsön.

## Context

- **Olvasandó fájlok:**
  - `client/src/main.tsx` — BroadcastChannel fül-átadás (törlendő) + ide kerül a chunk-hiba figyelő
  - `client/src/hooks/useAuth.tsx` — magic-link verify + OAuth exchange (`replaceState('/')` pontok)
  - `client/src/components/auth/LoginPage.tsx` — belépési képernyő (stash-pont)
  - `client/src/utils/storage.ts` — `safeLocalStorage` (újrahasznosítjuk)
  - `client/src/components/tasks/TaskListPage.tsx` — URL-paraméter effekt (211–257) + `loadTasks` (259–276) + TaskDrawer render (978)
  - `client/src/components/tasks/TaskDrawer.tsx` — Props + tab-váltás (komment-görgetéshez)
  - `client/src/components/tasks/tabs/CommentsTab.tsx` — komment-kártyák (anchor + scroll)
  - `server/src/services/notificationEmailService.ts` — `buildNotificationHtml` (URL-építés, 135. sor)
  - `server/src/routes/taskComments.ts` — komment- és reakció-email callsite-ok (199, 369)
- **Külső doksik:** Vite `vite:preloadError` esemény (Vite 5+; a projekt Vite 6.3.5-öt használ)
- **Követendő minták:**
  - `safeLocalStorage` wrapper a nyers `localStorage` helyett
  - Az `openTaskId` URL-paraméter meglévő kezelése (UUID-regex validálás + `replaceState` URL-tisztítás) — a `commentId` ugyanígy
  - `buildNotificationHtml` a kanonikus email-link építő (brain 2026-05-26 gotcha: kézzel SOSE építünk email-URL-t)
- **Ismert gotchák:**
  - A magic-link egy ÚJ fülön landol → a stash csak `localStorage`-ben működik (sessionStorage fülönkénti)
  - A `window.history.replaceState` cross-origin URL-re dob → a visszatérési útvonalat így is validáljuk (`/`-rel kezdődjön, `//`-rel ne)
  - Az index.html `no-cache`-sel megy ki (`server/src/app.ts:148`) → a chunk-hiba utáni reload garantáltan friss HTML-t kap
  - A drawer a Dashboardról is nyílik (`DashboardPage.tsx:583`) — ott nincs commentId, a prop opcionális
  - A `loading` state-et csak a legfrissebb kérés kezelheti, különben a skeleton villog

## Implementation Plan

1. **`client/src/utils/returnTo.ts` (új, ~30 sor):** `stashReturnTo()` — a jelenlegi
   `pathname+search`-öt `visoro_return_to` kulcs alá teszi (JSON: path + timestamp),
   kivéve ha az útvonal `/`; `consumeReturnTo()` — kiolvassa, törli, és csak akkor
   adja vissza, ha 60 percen belüli ÉS `/`-rel kezdődik (de nem `//`-rel).
   → Ellenőrzés: tsc zöld.
2. **`LoginPage.tsx`:** mount-effektben `stashReturnTo()`. **`useAuth.tsx`:** a
   magic-link verify success-ben és az OAuth exchange success-ben
   `window.history.replaceState({}, '', consumeReturnTo() ?? '/')` a `checkAuth()` előtt.
   → Ellenőrzés: lejárt sessionnel kattintott email-link belépés (mindkét mód) után a taskot nyitja.
3. **`main.tsx`:** a BroadcastChannel blokk (ping/pong/handoff/about:blank) törlése;
   a `window.name = 'sarcinator-app'` marad. Helyére kerül a `vite:preloadError`
   figyelő: `event.preventDefault()` + egyszeri `window.location.reload()`
   (sessionStorage-latch: 60 mp-en belül nem reloadol újra → nincs végtelen ciklus offline esetén).
   → Ellenőrzés: email-link másik nyitott app-fül mellett is helyben nyitja a taskot; üres lap nincs.
4. **Komment-horgony lánc:** `buildNotificationHtml` + opcionális `commentId` param
   (`&commentId=...` az URL-ben); a két callsite átadja (új komment: `rows[0].id`,
   reakció: `commentId`). `TaskListPage` URL-effekt: `commentId` kiolvasás (UUID-validálás)
   + state-be tesz + URL-ből töröl; `TaskDrawer` új opcionális `initialCommentId` propja
   a comments tabra vált; `CommentsTab` `highlightCommentId` propja: a kártya `id`-t kap,
   betöltés után `scrollIntoView` + ~2,5 mp kék kiemelés.
   → Ellenőrzés: komment-email linkje a kommenthez görget.
5. **`TaskListPage.loadTasks`:** kérés-sorszám őr (`loadSeqRef`) — csak a legutolsó
   kérés válasza írhatja a `tasks`/`total`/`loading` state-et.
   → Ellenőrzés: „Atribuite mie" ↔ „Create de mine" gyors váltogatás után mindig az aktív gombhoz tartozó lista látszik.

## Validation Loop

- `cd client && npx tsc -b && npx vite build` → zöld
- `cd server && npx tsc --noEmit` → zöld
- `npx eslint` az érintett fájlokra → az ÚJ sorokban 0 hiba (pre-existing debt nem nő)
- Manuális (Robert/Emo, élesben): (a) kijelentkezett állapotban email-linkre kattint →
  belépés után a task nyílik; (b) nyitott app-fül mellett email-link → új fülön a task
  nyílik, üres lap nincs; (c) komment-email → a kommenthez görget kiemeléssel;
  (d) a két szűrőgomb gyors váltogatása → a lista mindig az aktív gombnak felel meg;
  (e) deploy után régi fülön navigálás → egyszeri automatikus újratöltés, hibaüzenet nélkül.

## Out of Scope

- A 24 órás token-élettartam növelése / refresh-token (biztonsági döntés, külön kör)
- A harangos (in-app) értesítések komment-görgetése (csak az EMAIL-linkek)
- A magic-link emailbe ágyazott returnTo (szerver-oldali megoldás — a kliens-oldali stash elég)
- Saját mentett nézetek (`saved_filters`) régi `my_tasks` configjának migrálása
- Valódi lapozás az 500-as lista-limit fölé (PRP 001 óta ismert plafon)
