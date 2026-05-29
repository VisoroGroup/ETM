# 2026-05-29 — Csatolmány-megnyitás/letöltés cross-tenant 404 (X-Active-Company a raw fetch-eken)

**Tags:** attachments, multitenancy, frontend, files, ux
**Commit:** ca3e891
**Related:** [[2026-05-26-email-link-tenant-and-tab-handoff]], [[2026-05-26-email-i18n-superadmin-fix]]

## Mit kért

Robert screenshottal: **"nem megy megint a csatolmany megnezese es letoltese"**. A "Heitner Tamás- Visoro nagybefektetést bemutatni" task Fájlok fülén a `Visoro_Befektetoi_Prezentacio_F4 (1).pdf` (810.8 KB) örökre "Betöltés..."-nél állt, és letöltéskor piros "Hiba a letöltés során" toast jött. Tehát **az előnézet ÉS a letöltés is** hibázott, megint (a "megint" a kulcs — ez a tünet visszatérő).

## Mit változott

- [client/src/hooks/useAuthedFileUrl.tsx:9-16](client/src/hooks/useAuthedFileUrl.tsx) — új `authedFileHeaders()` helper, ami a JWT mellé az `X-Active-Company` headert is ráteszi (`getActiveCompanyId()`-ből). A hook `fetch`-e (39) és a `downloadAuthedFile` (70) is ezen megy keresztül. Korábban mindkettő csak az `Authorization` headert küldte.
- [client/src/components/tasks/tabs/FilesTab.tsx:43](client/src/components/tasks/tabs/FilesTab.tsx) — a hook `error` állapotát is kiolvassuk (`pdfPreviewError`), és a PDF-előnézet blokkba (196) beraktunk egy hiba-ágat: ha a fetch elhasal, piros `attachments.preview_error` szöveg jelenik meg a végtelen "Betöltés..." helyett. Plusz egy már-nem-használt `TaskAttachment` import törölve (lint error volt a fájlon).
- [client/src/i18n/locales/ro.json](client/src/i18n/locales/ro.json) + [hu.json](client/src/i18n/locales/hu.json) — új `attachments.preview_error` kulcs. (EN stub, RO-ra fallbackel — nem nyúltam hozzá.)

## Miért — döntések

**1. Mi volt a tényleges bug?** A `<img>` / `<iframe>` / `<a>` nem tud HTTP headert küldeni, ezért a fájlokat `fetch()`-csel húzzuk le JWT-vel és blob URL-t csinálunk. DE ez a raw `fetch` **megkerüli az axios `api` instance-t**, amelynek az interceptora ([api.ts:46-49](client/src/services/api.ts)) normál esetben automatikusan ráteszi az `X-Active-Company` headert. Így a fájl-fetch csak a JWT-t vitte, a tenant headert nem. A szerver ([auth.ts:47-53](server/src/middleware/auth.ts)) ilyenkor **csendben** visszaesik a user **első** cégére (`companyIds[0]`). Egy multi-céges usernek (Robert superadmin → minden cég) ha a csatolmány NEM az első cégébe tartozik, a `WHERE id = $1 AND company_id = $2` lookup nem talál → 404 → előnézet és letöltés is elhasal.

**2. Miért közös helper, nem inline?** Mindkét hívási hely (hook + download) ugyanazt a hibát hordozta. DRY: egy helyen javítva mindkettő gyógyul, és a jövőbeli harmadik fájl-fetch is ezt fogja használni.

**3. Miért `getActiveCompanyId()` és nem közvetlen localStorage olvasás?** Mert ez a függvény validálja az értéket, és ez **ugyanaz a forrás**, amit az axios interceptor is használ. Single source of truth — nem akarom, hogy a fájl-fetch és a sima API-hívás más céget lásson.

**4. Miért kellett a UX hiba-ág is?** A PDF-előnézet eddig csak a sikeres blobot figyelte, ezért bármilyen fetch-hiba végtelen "Betöltés..."-t adott (pont ezt látta Robert). A hiba-ág defense-in-depth: még ha a header-fix után is elhasal egyszer egy fetch (hálózat, törölt fájl), most hibát mutat, nem fagy.

## Gotcha jövő-Claude-nak

- **A SZABÁLY:** bármilyen **raw `fetch()`** (ami NEM az axios `api` instance-on megy) egy tenant-scoped végpontra **KÉZZEL kell** rárakja az `X-Active-Company` headert. Az interceptor csak az `api`-n átmenő kéréseket fedi. `<img>`/`<iframe>`/`<a>`/blob fetch nem megy rajta.
- **Ez MÁR a MÁSODIK ugyanilyen osztályú bug.** Az első az email-linkek cross-tenant 404-ja volt (01255e9, lásd [[2026-05-26-email-link-tenant-and-tab-handoff]]). Mindkettő: "a raw útvonal kihagyta a tenant headert". Ha **harmadik** is felbukkan, érdemes lehet egy közös `authedFetch` wrappert csinálni, ami mindig ráteszi — addig viszont a section 3 (Simplicity) miatt nem előlegezem meg.
- **A fájlok Postgres bytea-ban vannak** (`task_attachments.file_data` / `pug_project_attachments`), NEM lemezen. Tehát ez SOSE volt Railway ephemeral-storage probléma — ne arra menj el. (Spec doksi `ATTACHMENT_API_SPEC.md` ezt elavultan /uploads + multer-ként írja — ne hidd el.)
- **A szerver csendes fallbackja `companyIds[0]`-ra az, ami ELREJTI a hiányzó headert:** nem hibázik, hanem rossz tenant scope-ot szolgál ki, ami aztán 404-el a lookupnál. Ezért **single-céges usernek láthatatlan** (az ő cégük épp a [0]), és **csak multi-céges usert** harap meg. Robert multi-céges → ő látja; a legtöbb user nem. Reprodukálásnál ezt tartsd észben.
- **Nem tudtam lokálisan reprodukálni:** a hibázó fájl prod adat, a bug csak multi-céges usernél, nem-első cég csatolmányán jön elő, és nincs kliens teszt-harness. tsc + lint zöld, az érveléssel igazoltam; Robert élesben teszteli (push→Railway).

## Hivatkozások

- Nyitó commit: ca3e891 (2026-05-29).
- Azonos osztályú korábbi bug (email link): [[2026-05-26-email-link-tenant-and-tab-handoff]].
- Tenant resolution + fallback: [server/src/middleware/auth.ts:47-53](server/src/middleware/auth.ts).
- Axios interceptor + `getActiveCompanyId`: [client/src/services/api.ts](client/src/services/api.ts).
- Fájl-kiszolgáló végpont (auth + company scoping): [server/src/routes/files.ts](server/src/routes/files.ts).
