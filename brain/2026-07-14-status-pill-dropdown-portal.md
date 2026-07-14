# 2026-07-14 — Státusz-pilula legördülő portálba (overflow-clip fix)

**Tags:** tasks, dashboard, ux, frontend
**Commit:** e7f9081
**Related:** TASK.md "Státusz-legördülő levágódik" bejegyzés, brain/2026-06-08-ux-notifications-dashboard.md (a szekció-kártyák bevezetése)

## Mit kért

Robert screenshotot küldött a Dashboardról: az egyetlen Blocat taskon a
státusz-pilulára kattintva "nem látszik, milyen ablak jelenik meg" — a
legördülőből csak egy vékony csík látszott a sor alatt.

## Mit változott

- `client/src/components/tasks/InlineStatusPill.tsx` — a két legördülő
  (státusz-lista + blocat-indok panel) `position: absolute` helyett
  `createPortal(document.body)` + `position: fixed` pozícióval nyílik,
  a pilula `getBoundingClientRect()`-jéhez horgonyozva, jobbra igazítva.
  Ha a viewport alján 240px-nél kevesebb hely van, felfelé nyílik.
  Görgetésre/átméretezésre bezárul (kivéve a menün belüli görgetést,
  pl. textarea). A kívülre-kattintás figyelő most a `menuRef`-et is nézi,
  mert a menü már nem a `wrapRef` DOM-jában van.
- `client/src/whatsnew/releases.ts` — release id 2 (RO+HU).
- `TASK.md` — Done bejegyzés.

## Miért — döntések

- **Gyökérok:** a Dashboard/Sarcini szekció-kártyák `rounded-xl overflow-hidden`
  kombója (DashboardPage.tsx:326, TaskListPage.tsx:729) minden absolute
  gyereket levág a kártya szélén. A szekció utolsó soránál a menü teljes
  egészében a kártyán kívülre esett.
- **Portal vs. overflow-hidden eltávolítás:** az overflow-hidden kell a
  lekerekített sarkokhoz (a sorok háttere kilógna), és több helyen is
  megvan — a portál egy helyen javít mindent (Dashboard, Sarcini, Planner,
  Kanban, Focus mind ezt a pillt használja).
- **Görgetésre bezárás** (nem követés): a fixed menü elszakadna a horgonytól;
  a bezárás a szokásos dropdown-viselkedés és egyszerűbb.

## Gotcha jövő-Claude-nak

- Ez volt az **első** `createPortal` a kódbázisban — ha máshol is levágódik
  egy inline legördülő (pl. új menü egy szekció-kártyában), ugyanez a minta.
- A portálban lévő React szintetikus események a React-fa szerint buborékolnak,
  ezért a wrap div `stopPropagation`-je továbbra is megfogja őket — a sorra
  kattintás (task-fiók nyitás) nem sül el a menüben kattintva.
- A blocat-indok panel `autoFocus` textarea-ja nem vált ki scroll-eseményt,
  mert a fixed menü már a viewportban van — ha valaha mégis azonnal bezáródna
  a panel, ezt nézd meg először.

## Hivatkozások

- brain/2026-06-08-ux-notifications-dashboard.md — az InlineStatusPill és a
  szekció-kártyás Dashboard-elrendezés születése.
