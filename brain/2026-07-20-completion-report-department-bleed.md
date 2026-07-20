# 2026-07-20 — Befejezési jelentésen „Comunicare și HR" egy Hungary taskon

**Tags:** email, completion-report, department, multitenancy, template-type, legacy, frontend, backend
**Commit:** a3c1775
**Related:** [[2026-07-20-assignee-picker-orphaned-member]], [[2026-06-04-merge-completion-emails]]

## Mit kért
Robert screenshotot küldött egy **Visoro Hungary** feladat befejezési
jelentéséről (email), ahol a **„Részleg: Comunicare și HR"** szerepelt — pedig a
Hungary `simple` template, NINCS szervezeti/részleg-struktúrája. Jogosan kérdezte,
hogy keverednek-e a cégek a háttérben.

## Élő ellenőrzés (READ-only, Railway) — NEM keverednek a cégek
- A „Roman gpr…" task: `company_id=2` (Hungary), `department_label='departament_1'`,
  **org-scope FK-k (post/section/dept) MIND null**. Nincs Global-hoz kötés.
- Mind a **13 Hungary task** `department_label='departament_1'` (a legacy default).
- **Nulla** Hungary taskon van org-scope FK. → **nincs cross-company adat-bleed,
  a tenant-izoláció ép.** Csak egy kozmetikai címke szivárgott.

## Mit változott
- `server/src/services/taskCompletionReportService.ts` — a task-lekérdezés most a
  `companies.template_type`-ot is behúzza (`company_template_type`), és a „Részleg"
  sor (infoRow) **csak `full` template esetén** renderel. simple/project cégeknél
  (Hungary, Neo Plan) eltűnik.
- `client/src/whatsnew/releases.ts` — release id 7.

## Miért — döntések
- **Gyökérok:** két dolog együtt. (1) A `tasks.department_label` egy **legacy enum**
  (`departament_1`…`_7`, a `DEPARTMENTS` map „HR - Comunicare"-nek fordítja), ami az
  egycéges korszakból maradt; a `TaskFormModal` flat űrlapja (Hungary/Neo Plan)
  **alapból `departament_1`-et** küld (`department` state default, nincs UI a
  váltásra). (2) A befejezési jelentés a „Részleg" sort **feltétel nélkül** írta ki
  (taskCompletionReportService.ts:464), template_type-tól függetlenül.
- **Display-gate, nem adat-migráció:** a template_type-gate **visszamenőleg** minden
  meglévő és jövőbeli non-full taskot rendbe tesz, adat-írás nélkül. A 13 task
  `department_label`-je marad (ártalmatlan, mert gate-elve van).
- **NEM az én korábbi módosításaim okozták:** a task 2026-06-22-i; a felelős-fix
  (0836508), a useAuth (6cfd786), a PRP 009 őrök (de162ab) egyike sem nyúlt a
  `department_label`-hez vagy a completion reporthoz.

## Follow-up — teljes söprés (fafbad1)
Robert kérte, hogy nézzem át MINDENHOL. Audit (3-agent Workflow) + kézi grep az
összes `department_label`/`DEPARTMENTS`/`departmentLabel` felületre. Gate-elve
`template_type === 'full'`-ra (eddig SZIVÁRGOTT non-full cégnek):
- **Személyes feladatlista lapos táblázat** (Atribuite mie / Create de mine):
  a Részleg/Subdepartament/Poszt oszlopok (fejléc + desktop cellák + mobil inline
  meta) — TaskListPage `isPersonalView` ág.
- **Tömeges „Részleg" gomb** a bulk action bar-ban — TaskListPage.
- **CSV export** „Departament" oszlop — exportUtils (`includeDepartment` param,
  a hívó TaskListPage adja át `template_type==='full'`).
- **Tevékenységnapló** (ActivityFeedPage): részleg-szűrő + soronkénti chip.
- **Feladat tevékenység-tab** (ActivityTab): `label_changed` / `department_changed`
  bejegyzések (useCompany bekötve, üres desc → a sor kimarad).
- **Sablonok oldal** (TemplatesPage): kártya-chip + create-form részleg-mező
  (direct-URL only, nincs nav-link, de gate-elve).

MÁR HELYESEN gate-elt (nem nyúltam): completion report (a3c1775), day-view
email+oldal (`isFull`), dashboard task-sorok (`viewHelpers.locBits`, DashboardPage
`isFullTemplate ? ... : []`), CompletedTasksPage (`isFull`), TaskDrawer org-editor
(`isFullTemplate`), TaskFormModal org-cascade (`!useFlatForm`), PolicyDrawer
(ORG-departmentId UUID, nem legacy; + full-only megnyitó), AdminPage
(user-department attribútum, admin/full-only route+menü). CalendarView csak SZÍNRE
használja a DEPARTMENTS-t (nincs név), ezt hagytam.

## Gotcha jövő-Claude-nak
- **A flat create form (TaskFormModal) továbbra is `departament_1`-et stampol** a
  non-full taskokra (a `department` state default). Most ártalmatlan (display
  gate-elve), de ha valaha máshol is feltétel nélkül kiírják a `department_label`-t
  (napi összefoglaló email? más riport? Excel-export?), ott ugyanez a szivárgás
  visszajöhet. Opcionális tiszta megoldás: a flat form küldjön `department_label:
  null`-t, ill. minden department-megjelenítés gate-eljen template_type='full'-ra.
- **A `DEPARTMENTS` label-map (client/src/types) az egycéges Visoro Global
  részlegeit tükrözi** — ez cégfüggetlen konstans, csak `full` template alatt
  értelmes. Ne feltételezd, hogy bármely cég taskjának van valódi „részlege".
- A completion report a `taskCompletionReportService.ts`-ben van (nem a
  notificationEmailService-ben) — a merged completion email óta ([[2026-06-04-merge-completion-emails]]).

## Hivatkozások
- Élő ellenőrző szkript: session scratchpad `dept-bleed-check.js` (READ-only).
- `server/src/services/taskCompletionReportService.ts`, `client/src/types/index.ts`
  (`DEPARTMENTS`, `Department`), `client/src/components/tasks/TaskFormModal.tsx`
  (a `departament_1` default).
