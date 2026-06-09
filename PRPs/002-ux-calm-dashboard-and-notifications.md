# PRP: UX — Dashboard "lenyugtatása" + notifications olvasott/olvasatlan

**Státusz:** Implementálva 2026-06-08 (mockup-iterációval pontosítva, lásd brain `2026-06-08-ux-notifications-dashboard`)

> A végső dizájnt 4 mockup-körben (v1→v4) hangoltuk Roberttel. A PRP eredeti
> iránya áll; a finomítások: notificationsban **nevesített cég-pill** (szín +
> cégnév) minden soron; a Dashboard sorai **flex-re** írva (státusz-csík + cím +
> halvány „részleg · poszt" + a dátum a cím MELLETT + a meglévő InlineStatusPill
> mint státusz-vezérlő); szelídebb „În Atenție" panel.
**Indítva:** 2026-06-08
**Bejelentő:** Robert
**Érintett terület:** ux, dashboard, notifications, frontend
**Kapcsolódó:** TASK.md (Active), brain `2026-06-08-*`

## Goal

Robert visszajelzése: az app (főleg a Dashboard és a notifications) **túl zajos,
egybefolyik, nincs hierarchia, fárasztó megtalálni bármit**. Két, egymástól
független frontend-változás, egy deployban:

- **A rész (Notifications):** az olvasott és olvasatlan értesítés között
  jelenleg csak egy halvány háttér-árnyalat és félkövér a különbség, a bal
  oldali színes csík pedig a CÉG színe (minden soron ott van) → nem látszik,
  mi az új. Tegyük az olvasatlant **dominánssá**, az olvasottat **halvánnyá**.
- **B rész (Dashboard "lenyugtatás"):** ugyanaz a tartalom marad, de erős
  hierarchia és levegő: a nehéz szekciók (**Create de mine**, **Toate
  sarcinile pe utilizator**) **alapból összecsukva**, hogy a kezdőlap tisztán
  nyíljon (riasztások + 4 szám + **Sarcinile mele**), a többit Robert kinyitja,
  ha kell. Robert választása: "nyugtassuk le" (nem teljes újratervezés).

## Context

### Fájlok
- `client/src/components/notifications/NotificationBell.tsx` — a dropdown.
  Kulcs: `companyTintStyle` (199), egyedi sor (283–321), csoport (328–417),
  fejléc + mark_all_read (259–266).
- `client/src/components/dashboard/DashboardPage.tsx` — `renderTaskSection`
  fejléce (322–329, itt NINCS szekció-szintű összecsukás); szekció-hívások
  (528 = my_tasks, 536 = created_by_me); "Toate pe utilizator" blokk (545–616,
  fejléc 547); `collapsedStatuses` állapot (45, üresen indul); külső térköz
  `space-y-4 md:space-y-6` (383).
- `client/src/i18n/locales/{ro,hu}.json` — `notif` névtér (ro.json:741).
  Megvan: `notif.title`, `notif.mark_all_read`. Új kell: szűrő-feliratok.
  (en.json nem kap — RO-fallback, PLANNING §8.)

### Meglévő minták, amiket követünk
- A státusz-csoport összecsukás már létezik (`collapsedStatuses` + `toggleStatusCollapse`);
  a szekció-szintű összecsukáshoz ugyanezt a mintát bővítjük (egy kulcs/szekció).
- A `companyTintStyle` cég-szín-kódolása MARAD (multi-tenant azonosítás), csak
  már nem ez hordozza az olvasott/olvasatlan jelet.
- Kártya-stílus (`bg-navy-900/50 border border-navy-700/50 rounded-xl`) marad.

### Korlátok
- Frontend-only; backend és API érintetlen.
- Tenant-izoláció, adatlekérés változatlan (csak megjelenítés).

## Implementation Plan

### A — Notifications olvasott/olvasatlan (NotificationBell.tsx)
1. **Olvasatlan = domináns, olvasott = halvány.** → verify: vizuálisan rögtön
   elkülönül.
   - **Olvasatlan sor:** félkövér, teljes fényerő (text-white), **bal oldali
     3px cég-színű csík**, egy kis **tömör "olvasatlan" pötty** a sor elején,
     finom háttér-kiemelés.
   - **Olvasott sor:** normál vastagság, **tompított** (text-navy-400 +
     csökkentett opacitás), **nincs** bal csík, **nincs** háttér, **nincs**
     vezető pötty. A cég azonosítása marad egy halvány inline cég-pöttyel.
   - Ugyanez a logika a csoportos (grouped) értesítéseknél: `group.hasUnread`
     → olvasatlan stílus; ha minden olvasott → tompított.
2. **Fejléc:** a cím mellé **olvasatlan-számláló** (a meglévő `count`), a
   `mark_all_read` marad, és egy kis **"Doar necitite / Toate" szűrő-kapcsoló**.
   → verify: a kapcsoló csak az olvasatlanokat mutatja.
3. **i18n** (`notif`, ro+hu): `only_unread` ("Doar necitite" / "Csak olvasatlan"),
   `show_all` ("Toate" / "Mind"). → verify: nincs hiányzó kulcs RO-ban.

### B — Dashboard "lenyugtatás" (DashboardPage.tsx)
4. **Szekció-szintű összecsukás, a nehéz szekciók alapból zárva.** → verify: a
   Dashboard betöltéskor csak a riasztások + 4 szám + "Sarcinile mele" nyílik.
   - Új `collapsedSections` Set állapot, **alapból** tartalmazza: `created`
     (Create de mine) és `all_by_user` (Toate pe utilizator). A `assigned`
     (Sarcinile mele) nyitva.
   - A `renderTaskSection` fejléce (322–329) **kattintható** lesz (chevron +
     darabszám); zárva csak a fejléc látszik.
   - A "Toate pe utilizator" blokk fejléce (547) szintén szekció-toggle, zárva.
5. **Több levegő / tisztább elválasztás.** → verify: a szekciók közt érezhető
   térköz, a fejlécek kiemeltebbek.
   - Külső térköz növelése (`space-y-6 md:space-y-8`), a szekció-fejlécek
     valamivel nagyobb/erősebb kontraszt. Sorok érintetlenek (Simplicity §3).

## Validation Loop

- **Build:** `cd client && npm run build` (tsc -b && vite build) zöld.
- **Lint:** `npx eslint` a két érintett fájlon — csak pre-existing hibák,
  új nincs (Surgical §4).
- **Manuális teszt (Robert, élesben):**
  1. Nyisd meg a harang ikont: az **olvasatlan** értesítés félkövér + bal csík
     + pötty, az **olvasott** halvány. A "Doar necitite" csak az újakat mutatja.
     A "mark all read" után minden tompul.
  2. Töltsd be a Dashboardot: alapból csak a riasztások + a 4 szám +
     **Sarcinile mele** látszik kinyitva; a **Create de mine** és a **Toate pe
     utilizator** összecsukva (fejléc + szám). Kattintásra kinyílnak.

## Out of Scope

- **A Dashboard teljes újratervezése** (fülek, új kártya-rendszer) — Robert a
  "lenyugtatást" választotta, nem ezt.
- **A collapse-állapot perzisztálása** újratöltések közt (most: alapból zárva a
  nehéz szekciók, a kinyitás a sessionben él). Ha kell, külön, kis meló
  (userPreferences, mint a TaskListPage group-order).
- **A cél-szöveg banner** (fent, a Layoutban) — nem ehhez a PRP-hez tartozik.
- **Backend / API / adatszerkezet** — érintetlen.
- **Egyéb oldalak** (Vedere zilnică, Sarcini) — most nem, ha Robert kéri, külön.
