# 2026-06-12 — Email-link navigáció + lista/runtime megbízhatóság (Emo köre)

**Tags:** email, auth, tasks, task-list, filtering, notifications, deploy, frontend, backend
**Commit:** 5e13076
**Related:** PRPs/003-email-link-navigation-and-list-reliability.md, [[2026-05-26-email-link-tenant-and-tab-handoff]], [[2026-06-08-task-list-visibility-fixes]], [[2026-06-08-ux-notifications-dashboard]]

## Mit kért

Emo két bejelentése (Roberton át): (1) a "nálam" (Atribuite mie) nézetben Timi taskjait
is látja; (2) az email-linkek (task/komment) nem viszik a taskhoz. Diagnózis után Robert
5 tételt hagyott jóvá: returnTo a belépés után; handoff helyett helyben-nyitás;
komment-horgony; lista válasz-sorrend őr; stale-chunk auto-reload.

## Diagnózis (1. bejelentés — FONTOS jövőre)

- Élő adat (MCP): Emo (admin) 23 taskja mind jogosan az övé; **Timi mind a 8 taskját
  Emo hozta létre** → a "Create de mine"-ben jogosan látszanak.
- A kód szigorú volt mindkét helyen (tasks.ts:173 `t.assigned_to=$user`;
  DashboardPage:152 kliens-szűrés) → friss kód + friss adat NEM produkálja a tünetet.
- Két reális mechanizmus maradt: (a) **régi chunk a böngészőben** (jún. 8. előtti UI:
  egyetlen "Sarcinile mele" = my_tasks érintett-szuperhalmaz, abban Timi taskjai BENNE
  vannak); (b) **race** a két szűrőgomb gyors váltásánál (késő válasz felülír). Most
  MINDKETTŐ ellen védelem került be (auto-reload + seq-guard). Ha Emo újra jelzi:
  hány gomb van fent (1=régi UI), melyik aktív, hard refresh segít-e.

## Mit változott

- `client/src/utils/returnTo.ts` (ÚJ): stash/consume `visoro_return_to` localStorage-ben
  (JSON path+ts, 60 perc TTL, `/`-prefix validálás, `//` tiltva).
- [LoginPage.tsx:19](client/src/components/auth/LoginPage.tsx) mount-effekt: `stashReturnTo()`.
- [useAuth.tsx:50,76](client/src/hooks/useAuth.tsx) magic-link verify + OAuth exchange
  success: `replaceState(consumeReturnTo() ?? '/')` + **szintetikus PopStateEvent** (anélkül
  a React Router nem veszi észre), majd `checkAuth()`.
- [main.tsx](client/src/main.tsx): a teljes BroadcastChannel handoff (ping/pong/about:blank)
  TÖRÖLVE; `window.name='sarcinator-app'` maradt. Helyette `vite:preloadError` listener:
  `preventDefault()` + egyszeri `location.reload()` (60 mp-es sessionStorage latch).
- [notificationEmailService.ts:123](server/src/services/notificationEmailService.ts)
  `buildNotificationHtml` + opcionális `commentId` → `&commentId=...` az URL-ben.
- [taskComments.ts:213,380](server/src/routes/taskComments.ts): új komment/mention
  (`rows[0].id`) és reakció (`commentId`) emailek átadják.
- [TaskListPage.tsx](client/src/components/tasks/TaskListPage.tsx): URL-effekt `commentId`
  kiolvasás (UUID-validálás) → `pendingCommentId` state → drawer prop; URL-tisztításnál
  törlés; `loadSeqRef` monoton számláló a `loadTasks`-ban (elavult válasz: tasks/total/
  loading egyikét sem írhatja).
- [TaskDrawer.tsx:37](client/src/components/tasks/TaskDrawer.tsx): `initialCommentId` prop
  → kezdő tab `comments`; továbbadva CommentsTab-nak.
- [CommentsTab.tsx](client/src/components/tasks/tabs/CommentsTab.tsx): kártya `id=comment-<id>`
  horgony; effekt: ha a linkelt komment betöltődött → `scrollIntoView` + 2,5 mp kék ring
  (one-shot `scrolledToHighlight` ref — az 5 mp-es poll ne rángassa vissza).
- PRPs/003 (Approved 2026-06-12 beszélgetésben), TASK.md frissítve.

## Miért — döntések

1. **returnTo localStorage-ben, nem sessionStorage-ben:** a magic-link MINDIG új fülön
   landol, a sessionStorage fülönkénti → csak a localStorage látszik át. TTL + egyszeri
   fogyasztás + path-validálás fedi a kockázatokat. Szerver-oldali returnTo (emailbe
   ágyazva) elvetve — kliens-oldal elég, nincs open-redirect felület.
2. **A május 26-i handoff TUDATOSAN visszafordítva.** Akkor a cél a fül-szaporodás
   megfékezése volt; élesben kiderült: a böngésző nem engedi a háttér-fül fókuszálását,
   így a user üres lapot lát ("nem csinál semmit" élmény — Emo). Robert az "egy plusz
   fül kisebb baj, mint egy üres lap" tradeoffot választotta. A `target="sarcinator-app"`
   út (webmail, böngészőn belüli klikk) továbbra is fül-újrahasznosítást ad.
3. **replaceState után szintetikus popstate kell** — a Router csak arra frissít. Ugyanezt
   a mintát használta a (most törölt) handoff-fogadó is, élesben bizonyított.
4. **Seq-guard, nem AbortController:** a cél a determinisztikus "utolsó kérés nyer";
   a megszakítás plusz hibaág-kezelést hozna ugyanazért az eredményért.
5. **`vite:preloadError` (Vite 6) a lazy-route chunk-hibákra** — egy listener fedi az
   összes dinamikus importot; az index.html `no-cache` (app.ts:148), így a reload
   garantáltan friss manifestet kap. 60 mp-es latch a reload-ciklus ellen (offline eset).

## Gotcha jövő-Claude-nak

- **A wall-fül (ahol a login képernyő megszakította) magic-linkes belépésnél NYITVA
  marad a login képernyőn** — a belépés az ÚJ fülben fejeződik be. Cross-tab auth-sync
  nincs (tudatos out-of-scope; ha panasz lesz, storage-event a `visoro_token`-re).
- **Token-élettartam 24h maradt** (auth.ts:108) — a returnTo a tünetet kezeli, nem a
  gyakori lejáratot. Hosszabbítás/refresh = biztonsági döntés, Robertre vár.
- **A harang (NotificationBell) komment-kattintása NEM görget a kommenthez** — csak az
  email-link hordoz commentId-t. Ha kell, a notif payload-ból ugyanígy fűzhető.
- **Logout után a LoginPage a kilépéskori oldalt stash-eli** → újra-belépéskor oda tér
  vissza, nem a dashboardra. Apró viselkedésváltozás, szándékos.
- **A CommentsTab flash-timeout szándékosan nincs cleanup-olva** — a drawer 5 mp-es
  pollja újrafuttatná az effektet és a cleanup idő előtt törölné a kiemelést; React 18
  csendben elnyeli az unmount utáni setState-et.
- **Élő teszt deploy után esedékes** (MS365 + magic link + Apple Mail/Gmail app útvonalak)
  — lokálban nem reprodukálható (SSO roundtrip + email-kézbesítés + Railway deploy kell).
- A `visoro_chunk_reload_ts` sessionStorage-kulcs fülönkénti — több nyitott fül mind
  egyszer reloadol, ez várt viselkedés.

## Hivatkozások

- Commit: 5e13076; PRP: PRPs/003-email-link-navigation-and-list-reliability.md.
- Email-link rendszer eredete: [[2026-05-26-email-link-tenant-and-tab-handoff]] (a handoff
  ottani 5. döntése — about:blank fallback — bizonyult zsákutcának).
- A szűrő-szétválasztás háttere: [[2026-06-08-task-list-visibility-fixes]].
- A chunk-reload gotcha első említése: [[2026-06-08-ux-notifications-dashboard]].
