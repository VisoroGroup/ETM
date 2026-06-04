# 2026-06-04 — Havi riport "Load failed" (rossz bázis-URL + token-kulcs + hiányzó tenant header)

**Tags:** reports, raw-fetch, multitenancy, frontend, pdf, excel
**Commit:** 0d6f46e
**Related:** [[2026-05-29-attachment-tenant-header]], [[2026-05-26-email-link-tenant-and-tab-handoff]]

## Mit kért

Robert screenshottal: a "Generează raport lunar" ablakban a "Generează raport"
gomb hibát dob: **"Eroare la generarea raportului: Load failed"**. Kérte, nézzem
meg, "van egy gond". (Fontos: ez egy MÁSIK funkció, mint az aznapi befejezési-email
összevonás — meglévő, élő hiba volt, nem az okozta.)

## Mit változott

- [client/src/components/dashboard/ReportModal.tsx](client/src/components/dashboard/ReportModal.tsx)
  — a `generate()` nyers `fetch()`-e három ponton javítva:
  1. **Bázis-URL:** törölve a `const API_BASE = import.meta.env.VITE_API_URL ||
     'http://localhost:3001/api'`; az URL most relatív `/api/reports/monthly?...`
     (ugyanaz, mint az axios `api` instance `baseURL: '/api'`-ja).
  2. **Token-kulcs:** `safeLocalStorage.get('token')` → `'visoro_token'` (a kanonikus
     kulcs; useAuth ezt állítja, az interceptor ezt olvassa).
  3. **Tenant header:** `X-Active-Company` felrakva a `getActiveCompanyId()`-ből
     (import a services/api-ból).

## Miért — döntések

**1. Mi okozta a "Load failed"-et?** A "Load failed" a Safari üzenete egy
hálózati szinten elhasalt `fetch()`-re (HTTP 4xx/5xx NEM ezt adná — azt a kliens
kiolvasná `response.ok` ágon). Gyökér-ok: `API_BASE = VITE_API_URL || localhost:3001`,
és a `VITE_API_URL` **az egész kliensben sehol máshol nincs használva** → szinte
biztosan nincs a Railway buildben → élesben az `API_BASE` a `localhost:3001`-re
esik → a böngésző nem éri el → Load failed. **DEV-ben működött** (localhost:3001
elérhető), ezért nem tűnt fel korábban — klasszikus "dev-ben jó, prod-ban robban".

**2. Két rejtett bug ugyanabban a fetch-ben**, amik a bázis-fix után buknának elő:
- Token-kulcs `'token'` a `'visoro_token'` helyett → `Bearer null` → 401. (A
  `'visoro_token'` 45+ helyen a kanonikus; a ReportModal volt az EGYETLEN, ami
  `'token'`-t használt.)
- Hiányzó `X-Active-Company` → a szerver csendben `companyIds[0]`-ra esik
  (`auth.ts`) → rossz cég havi riportja. Multi-céges usert (Robert) harapja.

**3. A fix mindhármat megoldja a kódbázis bevett mintájával:** relatív `/api`
(mint az axios instance), helyes token-kulcs, és a `getActiveCompanyId()` (single
source, ugyanaz, mint az interceptornál és a `useAuthedFileUrl`-nél). Nem axios
`api`-n vezettem át (blob letöltés), mert a meglévő `useAuthedFileUrl` minta is
nyers fetch + kézi header — ezzel konzisztens, sebészi.

**4. A szerver oldal jó volt.** `requireRole('admin','manager')` a `ROLE_INHERITANCE`
miatt átengedi a superadmint (`superadmin: ['superadmin','admin','manager','user']`),
tehát Robert eléri a végpontot. A bug tisztán kliens-oldali.

## Gotcha jövő-Claude-nak

- **EZ A HARMADIK "nyers fetch kihagyta a tenant headert" osztályú bug** (1. email-link
  01255e9, 2. csatolmány ca3e891, 3. most a riport). A brain + TASK.md backlog
  szerint a 3. előfordulásnál érdemes közös `authedFetch` wrappert csinálni, ami a
  bázist + `visoro_token`-t + `X-Active-Company`-t mindig ráteszi. **Most NEM
  építettem be** (külön, 2-3 fájl: useAuthedFileUrl, ReportModal, esetleg
  ProjectFilesSection) — Robert döntésére vár (TASK.md backlog frissítve). Ha 4. is
  jön, csináld meg.
- **`import.meta.env.VITE_*` + localhost fallback = prod-csapda.** Ha az env nincs a
  buildben, localhost-ra esik és élesben robban. A kliensben a kanonikus API-bázis
  a **relatív `/api`** (axios `api` instance). Új fetch-nél NE használj
  `VITE_API_URL`-t/localhost fallbacket.
- **A token kanonikus kulcsa `'visoro_token'`.** Bármilyen raw localStorage
  token-olvasás ezt használja (nem `'token'`).
- **Ellenőrizendő (nem most):** `client/src/components/projects/ProjectFilesSection.tsx:83`
  szintén nyers fetch `visoro_token`-nel — nézd meg, ráteszi-e az `X-Active-Company`-t,
  különben ez a 4. előfordulás lehet.
- **`catch (e: any)` a fájlban pre-existing ESLint error** (45 helyen ez a minta a
  kliensben). Szándékosan NEM javítottam (Surgical §4 + kódbázis-konzisztencia).

## Hivatkozások

- Commit: 0d6f46e (`fix(reports): fix monthly report download failing with "Load failed"`).
- Azonos osztályú korábbi bug-ok: [[2026-05-29-attachment-tenant-header]] (a
  `authedFileHeaders()` minta), [[2026-05-26-email-link-tenant-and-tab-handoff]].
- Szerver-végpont: [server/src/routes/reports.ts](server/src/routes/reports.ts)
  (`GET /api/reports/monthly`, PDF/Excel, `requireRole('admin','manager')`).
- Axios bázis + interceptor: [client/src/services/api.ts](client/src/services/api.ts).
