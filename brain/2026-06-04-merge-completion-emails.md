# 2026-06-04 — Lezáráskor a két email (státusz + összesítő) egybeolvasztása

**Tags:** email, notifications, tasks, completion-report, multitenancy
**Commit:** d324fcf
**Related:** [[2026-05-26-email-i18n-superadmin-fix]], [[2026-05-26-email-link-tenant-and-tab-handoff]]

## Mit kért

Robert: amikor egy taskot `terminat`-ra állít, két külön email megy ki — egy a
státuszváltásról ("X átállította TERMINAT-ra"), majd egy az összesítővel (mi
történt a taskban). Ez redundáns, egy emailbe akarta vonni. **Választott a két
értelmezés közül a B opciót:** ne csak dedupláljunk, hanem a státusz-fejléc
kerüljön az összesítő tetejére, és csak ez az egy email menjen ki. Elfogadta,
hogy így a korábban csak rövid emailt kapók most a teljes összesítőt kapják.

## Mit változott

- [server/src/routes/tasks.ts:660](server/src/routes/tasks.ts) — a státusz-váltó
  végpont email-blokkja. `terminat` esetén MÁR NEM megy ki külön `status_changed`
  email; helyette egyetlen `completion_report` megy a **stakeholderek ∪
  riport-címzettek** uniójának (Map id-szerinti dedup). Más státusznál (de_rezolvat
  / in_realizare / blocat) változatlan a régi `status_changed` email. A holt
  `status === 'terminat' ? '#d1fae5' : ...` ternary-ág kivéve a státusz-emailből
  (ott már sosem `terminat`).
- [server/src/services/taskCompletionReportService.ts:330](server/src/services/taskCompletionReportService.ts)
  — `buildCompletionReportHtml` kapott egy opcionális 3. paramétert:
  `statusChange?: { oldStatus, newStatus, actorName, reason? }`. Ha megvan, a
  felső zöld "kész" sávba beépül a `régi → Befejezve` badge + "Lezárta: X" (+ indok,
  ha van). Új i18n-kulcs `completed_by` RO/HU/EN-re (`REPORT_LABELS`).

## Miért — döntések

**1. B opció (valódi merge), nem dedup-only.** Robert kifejezetten ezt választotta.
A címzettek uniója kell, hogy senki ne maradjon le: a `status_changed` címzettje
a `getTaskStakeholders` (kizárja az aktort), a `completion_report`-é a
`getCompletionReportRecipients` (NEM zárja ki, + Robert/Maria always-receive).
Aki mindkettőben volt (tipikusan a creator, aki egyben always-receive is) kapta a
duplát. Az unió + dedup garantálja: pontosan egy email/ember.

**2. Egyetlen folyamat érintett.** A `completion_report` CSAK a
`routes/tasks.ts`-ben épül (`getCompletionReportRecipients` /
`buildCompletionReportHtml` egyetlen callsite). A `taskService.ts` két
`sendNotificationEmail` hívása (`task_created_assigned`, `task_assigned`)
hozzárendelés-értesítő, nem státusz → a dupla SOSE keletkezett máshol. Ezért a
javítás egyetlen helyre lokalizált.

**3. Banner a builderben, nem a hívóban.** Hogy egy kártyán belül legyen
(ne két külön doboz), a státusz-sávot a riport saját zöld bannerébe építettem,
a riport `t()` (REPORT_LABELS) namespace-ével — nem a `notif_email.*`-gal.

**4. Per-language cache marad helyes.** A riport nem tartalmaz címzett-specifikus
adatot (nincs "Kedves X" megszólítás benne, ellentétben a `buildNotificationHtml`-lel),
csak task + actor. Ezért nyelvenként egyszer építeni + cache-elni biztonságos.

## Gotcha jövő-Claude-nak

- **`buildCompletionReportHtml` most 3 paramos**, a 3. opcionális. Egyetlen hívó
  (routes/tasks.ts). Ha máshol is generálsz riportot (pl. cron havi összesítő),
  a `statusChange` elhagyható → nincs felső badge, a riport ugyanúgy működik.
- **A status-history szekció IS listázza a végső átmenetet** (a `task_status_changes`
  táblából). A felső banner ezt EMELI KI, nem duplikálja hibásan — szándékos.
- **`emailType` marad `'completion_report'`** (email_logs folytonosság). A
  `'status_changed'` email `terminat`-nál már nem keletkezik — ha email-statisztikát
  nézel, ez a várt viselkedés 2026-06-04 után.
- **Mellékhatás (Robert elfogadta):** a tiszta stakeholderek (pl. alfeladat-felelős,
  aki nem riport-címzett) mostantól a teljes összesítőt kapják a rövid email helyett.
  Nincs új adatszivárgás — ők a taskot az appban amúgy is látják (azonos tenant).
- **Nincs teszt-harness erre** (csak `dateUtils` + `validation` unit teszt a szerveren).
  `tsc` + production build zöld; Robert élesben (Railway) teszteli.

## Hivatkozások

- Commit: d324fcf (`fix(tasks): merge status-change and completion-report emails on completion`).
- Ugyanaz az email-rendszer korábbról: [[2026-05-26-email-i18n-superadmin-fix]]
  (`resolveRecipientLocale`, ALWAYS_RECEIVE_EMAILS), [[2026-05-26-email-link-tenant-and-tab-handoff]].
- Ugyanennek a sessionnek a másik fele: [[2026-06-04-monthly-report-load-failed]].
- TASK.md (Done), PLANNING.md §4.1 (email komponens).
