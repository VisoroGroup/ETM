# brain/INDEX.md

> Append-only index. Új bejegyzés mindig **a táblázat tetejére** kerül
> (legfrissebb fent). A `slug` megegyezik a fájlnévvel `.md` nélkül.

| Dátum | Slug | Tags | Cím |
|-------|------|------|-----|
| 2026-06-08 | [2026-06-08-drawer-drag-close-and-open-404](2026-06-08-drawer-drag-close-and-open-404.md) | tasks, task-drawer, comments, ux, multitenancy | Drawer nem zár be komment-szöveg kijelölésekor (onMouseDown + target-őr); task-open 404 ("nu există/acces") vizsgálva, NYITVA (repro kell) |
| 2026-06-08 | [2026-06-08-task-list-visibility-fixes](2026-06-08-task-list-visibility-fixes.md) | tasks, task-list, filtering, org-view, multitenancy, frontend, backend | "Sarcinile mele" kettéválasztva (Atribuite mie / Create de mine); lista 50→500 limit; szervezeti nézetbe "Fără atribuire" csoport a besorolatlan taskoknak (Emo 2 bug) |
| 2026-06-05 | [2026-06-05-open-day-week-monthly-views](2026-06-05-open-day-week-monthly-views.md) | access-control, permissions, dayview, weekview, reports, multitenancy | Napi/heti nézet + havi riport megnyitva minden belépett usernek (requireRole('user') + route/menü/gomb feloldva); tenant-szűrés érintetlen, cégek közt nincs átlátás |
| 2026-06-04 | [2026-06-04-monthly-report-load-failed](2026-06-04-monthly-report-load-failed.md) | reports, raw-fetch, multitenancy, frontend, pdf, excel | Havi riport "Load failed" — ReportModal nyers fetch localhost bázisra esett (VITE_API_URL unset); + rossz token-kulcs (`visoro_token`) + hiányzó X-Active-Company. 3. raw-fetch tenant bug |
| 2026-06-04 | [2026-06-04-merge-completion-emails](2026-06-04-merge-completion-emails.md) | email, notifications, tasks, completion-report, multitenancy | Lezáráskor a státusz + összesítő email egybeolvasztva — egy merged completion_report az unió(stakeholders ∪ report-címzettek)-nak, státusz-banner a tetején (B opció) |
| 2026-05-30 | [2026-05-30-drop-english-language](2026-05-30-drop-english-language.md) | i18n, multitenancy, frontend, ux, communication | Angol kivéve a cég-nyelv választóból — csak frontend (DB/típus/en.json érintetlen, RO-fallback marad); kommunikációs lecke: ne tolj technikai kérdést Robertre |
| 2026-05-29 | [2026-05-29-project-anchors-bootstrap](2026-05-29-project-anchors-bootstrap.md) | planning, governance, i18n, docs, setup | Alapfájlok (PLANNING/TASK/examples/PRPs) felépítve a kódból; PROJECT.md elavult; EN nyelv elejtve; push-gate lecke |
| 2026-05-29 | [2026-05-29-attachment-tenant-header](2026-05-29-attachment-tenant-header.md) | attachments, multitenancy, frontend, files, ux | Csatolmány megnézés/letöltés cross-tenant 404 — raw fetch kihagyta az X-Active-Company headert (+ PDF-előnézet hiba-ág) |
| 2026-05-26 | [2026-05-26-dashboard-alerts-stale](2026-05-26-dashboard-alerts-stale.md) | dashboard, alerts, react-state, ui | "În Atenție" banner stale az új alertek után — AlertsTab nem hívott onUpdate-et a parent felé |
| 2026-05-26 | [2026-05-26-email-link-tenant-and-tab-handoff](2026-05-26-email-link-tenant-and-tab-handoff.md) | email, multitenancy, frontend, broadcastchannel, ux | Email link cross-tenant 404 fix (companyId an URL-ben) + BroadcastChannel tab handoff (Apple Mail / Outlook stripeli a `target`-et) |
| 2026-05-26 | [2026-05-26-email-i18n-superadmin-fix](2026-05-26-email-i18n-superadmin-fix.md) | i18n, email, multitenancy, ui, notifications | Email i18n bug (superadmin user_companies JOIN) + Sarcini accordion + email-tab reuse |
| 2026-05-19 | [2026-05-19-i18n-hardening-wave](2026-05-19-i18n-hardening-wave.md) | i18n, dates, file-upload, public-pages | i18n hardening hullám: date-fns locale, magyar fájlnevek, relative-time, public oldalak |
| 2026-05-17 | [2026-05-17-pug-subsystem-launch](2026-05-17-pug-subsystem-launch.md) | pug, projects, templates, attachments, mobile, public-share | PUG (Projekt Ügymenet) alrendszer indulása — Talajradar/David-GPR projekt-flow |
