# 2026-06-16 — E-mail márkanév: ETM → Sarcinator

**Tags:** email, i18n, branding, notifications, reports
**Commit:** 017db45
**Related:** [[2026-05-26-email-i18n-superadmin-fix]], [[2026-06-04-merge-completion-emails]], [[2026-06-12-email-link-navigation-and-reliability]]

## Mit kért

Robert: a postaládájában az értesítő e-mailek tárgysora és fejléce még mindig
"ETM"-et mutat (`[ETM] Mențiune — …`, `[ETM] Sumar zilnic — …`, a törzs tetején
nagy "ETM" cím), pedig a rendszer neve már **Sarcinator**. Cseréljük le. Két döntés:
**írásmód** = "Sarcinator" (nagy kezdőbetű, nem csupa nagybetű); **hatókör** =
e-mailek + minden látható hely (de a webhook technikai fejléceket NE).

## Mit változott

- [serverI18n.ts](server/src/i18n/serverI18n.ts) — minden `ETM` → `Sarcinator`
  (RO/HU/EN, 43 előfordulás): jelentés-címek (`report.title`), napi össz. tárgy
  (`daily_email.subject`), láblécek (`*.footer`), és a 10 `notif_email.subj_*`
  tárgysor-sablon nyelvenként. A `[ETM]`-et dokumentáló komment is.
- [serverI18n.ts:419,428](server/src/i18n/serverI18n.ts) — **magyar névelő-javítás:**
  az eredeti `az ETM küldte` → `a Sarcinator küldte` (a vak `ETM→Sarcinator` csere
  `az Sarcinator`-t hagyott; "Sarcinator" mássalhangzóval kezdődik → `a`, nem `az`).
- [notificationEmailService.ts:148](server/src/services/notificationEmailService.ts)
  és [emailScheduler.ts:64](server/src/cron/emailScheduler.ts) — a fejléc nagy
  `<h1>ETM</h1>` wordmark → `Sarcinator`. **Két külön fájlban duplikálva**, nincs
  közös header-komponens.
- [reports.ts:234](server/src/routes/reports.ts) — `workbook.creator = 'Sarcinator'`
  (Excel-export szerző-metaadat).
- [pugProjects.ts:810](server/src/routes/pugProjects.ts) — PUG projekt-PDF lábléc
  `• Visoro Sarcinator`.
- [ro.json:482](client/src/i18n/locales/ro.json),
  [hu.json:482](client/src/i18n/locales/hu.json) — megosztó-ablak súgója:
  `cont Sarcinator` / `Sarcinator-fiók`.

## Miért — döntések

1. **Közvetlen string-csere, nincs központi `BRAND` konstans.** A márkanév sok
   helyen, külön volt bedrótozva. Egy `BRAND` konstans bevezetése + a sablonok
   átszervezése nagyobb, kockázatosabb meló lett volna (Simplicity §3, Surgical §4).
   A `serverI18n.ts` minden `ETM`-je márka-string volt, így ott a teljes csere
   biztonságos volt. **Ha jövőben megint rebrand kell, ugyanígy: grep `ETM`** —
   nincs egy hely, ahol átírni.
2. **Hatókör: látható helyek igen, technikai NEM.** A webhook fejlécek
   (`X-ETM-Event`, `X-ETM-Delivery`, `X-ETM-Signature`, `User-Agent: ETM-Webhook/1.0`)
   szándékosan maradtak — külső integrációk illeszthetnek rájuk, átnevezés =
   breaking change. Szintén maradt (nem látható): `mcp/package.json` leírás,
   egy kódkomment a `PublicProjectPage.tsx`-ben, és a nem-deployolt `ux-mockup.html`.
3. **"Sarcinator", nem "SARCINATOR".** Robert választása — terméknév-szerű, nagy
   kezdőbetű. A belső `window.name = 'sarcinator-app'` és a `target="sarcinator-app"`
   (2026-05-26 óta) már eddig is ez volt; a megjelenő név most végre egyezik vele.

## Gotcha jövő-Claude-nak

- **A magyar `a`/`az` névelő csapda.** Az "ETM" magánhangzóval ejtett betűszó
  (`az ETM`), a "Sarcinator" mássalhangzós (`a Sarcinator`). Bármilyen jövőbeli
  HU márkanév-csere után ELLENŐRIZD a névelőt — a vak find-replace elrontja.
- **A fejléc-wordmark KÉT fájlban van** (notificationEmailService + emailScheduler),
  nincs közös komponens. Wordmark-változásnál mindkettőt kell.
- **Az app saját felülete sehol nem mutatott "ETM"-et** — csak a szerver-oldali
  e-mailek/jelentések. A grep után `ETM` már csak a fenti, szándékosan kihagyott
  helyeken van. A látható rebrand ezzel teljes.
- **Új e-mail template írásakor** a tárgy-prefix mintája immár `[Sarcinator] …`
  (serverI18n `subj_*`), a fejlécben `Sarcinator` wordmark, `target="sarcinator-app"`.
- **Nincs automata teszt e-mail-stringekre** (a szerveren csak `dateUtils`/`validation`
  unit teszt). Validáció: szerver `tsc` zöld + Robert élő teszt. A locale-JSON-okat
  `JSON.parse`-szal ellenőriztem (érvényesség), nem futott teljes `vite build`
  (csak szöveg-érték változott; a teljes build a Railway-en fut deploy-kor).
- `server/tsconfig.tsbuildinfo` továbbra is untracked, NINCS gitignore-olva (pre-existing,
  session elején is így volt) — érdemes lehet egyszer `.gitignore`-ba tenni, de most
  nem nyúltam hozzá (scope).

## Hivatkozások

- Commit: 017db45 (`fix(email): rebrand ETM → Sarcinator in emails, reports, share UI`).
- Ugyanaz az e-mail-rendszer: [[2026-05-26-email-i18n-superadmin-fix]] (a
  `target="sarcinator-app"` / `window.name` eredete), [[2026-06-04-merge-completion-emails]],
  [[2026-06-12-email-link-navigation-and-reliability]].
- TASK.md (Done, 2026-06-16).
