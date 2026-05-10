/**
 * Server-side i18n helper.
 *
 * Mirrors the lookup pattern used by the client `I18nContext.tsx`:
 *   - dotted keys (e.g. "report.title")
 *   - {{var}} interpolation
 *   - if a key is missing, the key itself is returned (typos easy to spot)
 *
 * The dictionaries are embedded as module-level constants so the helper
 * can be required from anywhere on the server without any FS access.
 */

export type ServerLocale = 'ro' | 'hu' | 'en';

type Dict = Record<string, any>;

const RO: Dict = {
    report: {
        title: 'ETM — Raport lunar',
        generated_at: 'Generat la: {{date}}',
        section_summary: 'Sumar sarcini',
        section_departments: 'Detalii pe departamente',
        section_users: 'Detalii pe utilizatori',

        sheet_summary: 'Sumar',
        sheet_departments: 'Departamente',
        sheet_users: 'Utilizatori',

        sheet_title_monthly: 'Raport lunar — {{month}} {{year}}',
        month_year: '{{month}} {{year}}',

        col_indicator: 'Indicator',
        col_value: 'Valoare',
        col_department: 'Departament',
        col_total: 'Total',
        col_completed: 'Completate',
        col_overdue: 'Restante',
        col_user: 'Utilizator',
        col_total_assigned: 'Total asignate',

        stat_created: 'Create în această lună',
        stat_completed: 'Completate în această lună',
        stat_overdue: 'Restante',
        stat_blocked: 'Blocate',

        error_no_active_company: 'Companie activă lipsește.',
        error_month_required: 'Parametrul month este obligatoriu (format: YYYY-MM).',
        error_invalid_sections: 'Parametru sections invalid. Valori valide: tasks, departments, users.',

        empty_dept: '—',

        month_1: 'Ianuarie',
        month_2: 'Februarie',
        month_3: 'Martie',
        month_4: 'Aprilie',
        month_5: 'Mai',
        month_6: 'Iunie',
        month_7: 'Iulie',
        month_8: 'August',
        month_9: 'Septembrie',
        month_10: 'Octombrie',
        month_11: 'Noiembrie',
        month_12: 'Decembrie',
    },
    daily_email: {
        subject: '[ETM] Sumar zilnic — {{date}}',
        header_subtitle: 'Sumar zilnic — {{date}}',
        greeting: 'Bună dimineața, {{name}}!',
        intro: 'Iată sumarul sarcinilor tale pentru astăzi:',
        section_overdue: 'DEPĂȘITE ({{count}})',
        section_today: 'SCADENTE AZI ({{count}})',
        section_upcoming: 'SCADENTE ÎN CURÂND ({{count}})',
        section_weekly: 'REMINDER SĂPTĂMÂNAL ({{count}})',
        section_blocked: 'BLOCATE ({{count}})',
        days_overdue: 'depășit cu {{days}} zile',
        due_today_label: 'scadent azi',
        due_in_days: 'scadent în {{days}} zile ({{date}})',
        weekly_due_on: 'scadent pe {{date}} (peste {{days}} zile)',
        blocked_reason_prefix: 'Motiv',
        no_tasks: 'Nu ai sarcini active astăzi.',
        footer: 'Această notificare a fost generată automat de ETM.',
        col_title: 'Sarcină',
        col_due: 'Scadență',
        col_status: 'Status',
        col_post: 'Departament',
    },
    notif_email: {
        greeting: 'Bună, {{name}}!',
        cta_open_task: 'Deschide sarcina',
        footer: 'Această notificare a fost generată automat de ETM.',

        // Subjects (used as `[ETM] {{subject}} — {{title}}`)
        subj_task_assigned: '[ETM] Sarcină atribuită — {{title}}',
        subj_task_reassigned: '[ETM] Sarcină nouă atribuită — {{title}}',
        subj_comment: '[ETM] Comentariu nou — {{title}}',
        subj_mention: '[ETM] Mențiune — {{title}}',
        subj_reaction: '[ETM] Reacție {{reaction}} — {{title}}',
        subj_subtask_assigned: '[ETM] Sub-sarcină atribuită — {{title}}',
        subj_subtask_completed: '[ETM] Sub-sarcină finalizată — {{title}}',
        subj_checklist_checked: '[ETM] Checklist bifat — {{title}}',
        subj_status_changed: '[ETM] Status: {{status}} — {{title}}',
        subj_completion_report: '[ETM] Raport finalizare — {{title}}',

        // Subtitles (short header lines in the email body)
        sub_task_assigned: 'Sarcină atribuită',
        sub_task_reassigned: 'Sarcină nouă atribuită',
        sub_comment: 'Comentariu nou',
        sub_mention: 'Mențiune nouă',
        sub_reaction: 'Reacție nouă',
        sub_subtask_assigned: 'Sub-sarcină atribuită',
        sub_subtask_completed: 'Sub-sarcină finalizată',
        sub_checklist_checked: 'Element checklist finalizat',
        sub_status_changed: 'Status schimbat → {{status}}',

        // First body line (the main user-visible sentence)
        body_user_assigned_new_task: '<strong>{{actor}}</strong> ți-a atribuit o sarcină nouă:',
        body_user_assigned_task: '<strong>{{actor}}</strong> ți-a atribuit o sarcină:',
        body_user_commented: '<strong>{{actor}}</strong> a adăugat un comentariu la sarcina:',
        body_user_mentioned_you: '<strong>{{actor}}</strong> te-a menționat într-un comentariu la sarcina:',
        body_user_reacted: '<strong>{{actor}}</strong> a reacționat {{reaction}} la comentariul tău la sarcina:',
        body_user_assigned_subtask: '<strong>{{actor}}</strong> ți-a atribuit o sub-sarcină:',
        body_user_completed_subtask: '<strong>{{actor}}</strong> a finalizat o sub-sarcină:',
        body_user_checked_item: '<strong>{{actor}}</strong> a bifat un element din checklist:',
        body_user_changed_status: '<strong>{{actor}}</strong> a schimbat statusul sarcinii:',

        // Status labels (mirror client STATUSES)
        status_de_rezolvat: 'De rezolvat',
        status_in_realizare: 'În realizare',
        status_terminat: 'Terminat',
        status_blocat: 'Blocat',
    },
};

const HU: Dict = {
    report: {
        title: 'ETM — Havi jelentés',
        generated_at: 'Készült: {{date}}',
        section_summary: 'Feladatok összesítése',
        section_departments: 'Bontás osztályok szerint',
        section_users: 'Bontás felhasználók szerint',

        sheet_summary: 'Összesítő',
        sheet_departments: 'Osztályok',
        sheet_users: 'Felhasználók',

        sheet_title_monthly: 'Havi jelentés — {{month}} {{year}}',
        // Hungarian convention: "2026. április"
        month_year: '{{year}}. {{month}}',

        col_indicator: 'Mutató',
        col_value: 'Érték',
        col_department: 'Osztály',
        col_total: 'Összesen',
        col_completed: 'Befejezett',
        col_overdue: 'Lejárt',
        col_user: 'Felhasználó',
        col_total_assigned: 'Hozzárendelve összesen',

        stat_created: 'Ebben a hónapban létrehozva',
        stat_completed: 'Ebben a hónapban befejezve',
        stat_overdue: 'Lejárt',
        stat_blocked: 'Blokkolt',

        error_no_active_company: 'Hiányzik az aktív cég.',
        error_month_required: 'A month paraméter kötelező (formátum: YYYY-MM).',
        error_invalid_sections: 'Érvénytelen sections paraméter. Érvényes értékek: tasks, departments, users.',

        empty_dept: '—',

        month_1: 'január',
        month_2: 'február',
        month_3: 'március',
        month_4: 'április',
        month_5: 'május',
        month_6: 'június',
        month_7: 'július',
        month_8: 'augusztus',
        month_9: 'szeptember',
        month_10: 'október',
        month_11: 'november',
        month_12: 'december',
    },
    daily_email: {
        subject: '[ETM] Napi összefoglaló — {{date}}',
        header_subtitle: 'Napi összefoglaló — {{date}}',
        greeting: 'Jó reggelt, {{name}}!',
        intro: 'Itt a mai feladataid összefoglalója:',
        section_overdue: 'LEJÁRT ({{count}})',
        section_today: 'MAI HATÁRIDŐS ({{count}})',
        section_upcoming: 'HAMAROSAN LEJÁR ({{count}})',
        section_weekly: 'HETI EMLÉKEZTETŐ ({{count}})',
        section_blocked: 'BLOKKOLT ({{count}})',
        days_overdue: '{{days}} napja lejárt',
        due_today_label: 'ma esedékes',
        due_in_days: '{{days}} nap múlva esedékes ({{date}})',
        weekly_due_on: '{{date}}-án esedékes ({{days}} nap múlva)',
        blocked_reason_prefix: 'Indok',
        no_tasks: 'Ma nincs aktív feladatod.',
        footer: 'Ezt az értesítést automatikusan az ETM küldte.',
        col_title: 'Feladat',
        col_due: 'Határidő',
        col_status: 'Állapot',
        col_post: 'Osztály',
    },
    notif_email: {
        greeting: 'Szia, {{name}}!',
        cta_open_task: 'Feladat megnyitása',
        footer: 'Ezt az értesítést automatikusan az ETM küldte.',

        // Subjects
        subj_task_assigned: '[ETM] Feladat hozzárendelve — {{title}}',
        subj_task_reassigned: '[ETM] Új feladat hozzárendelve — {{title}}',
        subj_comment: '[ETM] Új hozzászólás — {{title}}',
        subj_mention: '[ETM] Említés — {{title}}',
        subj_reaction: '[ETM] Reakció {{reaction}} — {{title}}',
        subj_subtask_assigned: '[ETM] Részfeladat hozzárendelve — {{title}}',
        subj_subtask_completed: '[ETM] Részfeladat befejezve — {{title}}',
        subj_checklist_checked: '[ETM] Ellenőrzőlista pipálva — {{title}}',
        subj_status_changed: '[ETM] Állapot: {{status}} — {{title}}',
        subj_completion_report: '[ETM] Befejezési jelentés — {{title}}',

        // Subtitles
        sub_task_assigned: 'Feladat hozzárendelve',
        sub_task_reassigned: 'Új feladat hozzárendelve',
        sub_comment: 'Új hozzászólás',
        sub_mention: 'Új említés',
        sub_reaction: 'Új reakció',
        sub_subtask_assigned: 'Részfeladat hozzárendelve',
        sub_subtask_completed: 'Részfeladat befejezve',
        sub_checklist_checked: 'Ellenőrzőlista elem befejezve',
        sub_status_changed: 'Állapot megváltoztatva → {{status}}',

        // Body lines
        body_user_assigned_new_task: '<strong>{{actor}}</strong> új feladatot rendelt hozzád:',
        body_user_assigned_task: '<strong>{{actor}}</strong> feladatot rendelt hozzád:',
        body_user_commented: '<strong>{{actor}}</strong> hozzászólt a feladathoz:',
        body_user_mentioned_you: '<strong>{{actor}}</strong> megemlített téged egy hozzászólásban a feladatnál:',
        body_user_reacted: '<strong>{{actor}}</strong> {{reaction}} reakciót adott a hozzászólásodhoz a feladatnál:',
        body_user_assigned_subtask: '<strong>{{actor}}</strong> részfeladatot rendelt hozzád:',
        body_user_completed_subtask: '<strong>{{actor}}</strong> befejezett egy részfeladatot:',
        body_user_checked_item: '<strong>{{actor}}</strong> kipipált egy ellenőrzőlista elemet:',
        body_user_changed_status: '<strong>{{actor}}</strong> megváltoztatta a feladat állapotát:',

        // Status labels
        status_de_rezolvat: 'Megoldandó',
        status_in_realizare: 'Folyamatban',
        status_terminat: 'Befejezve',
        status_blocat: 'Blokkolva',
    },
};

const EN: Dict = {
    report: {
        title: 'ETM — Monthly report',
        generated_at: 'Generated at: {{date}}',
        section_summary: 'Task summary',
        section_departments: 'Breakdown by department',
        section_users: 'Breakdown by user',

        sheet_summary: 'Summary',
        sheet_departments: 'Departments',
        sheet_users: 'Users',

        sheet_title_monthly: 'Monthly report — {{month}} {{year}}',
        month_year: '{{month}} {{year}}',

        col_indicator: 'Indicator',
        col_value: 'Value',
        col_department: 'Department',
        col_total: 'Total',
        col_completed: 'Completed',
        col_overdue: 'Overdue',
        col_user: 'User',
        col_total_assigned: 'Total assigned',

        stat_created: 'Created this month',
        stat_completed: 'Completed this month',
        stat_overdue: 'Overdue',
        stat_blocked: 'Blocked',

        error_no_active_company: 'Active company is missing.',
        error_month_required: 'The month parameter is required (format: YYYY-MM).',
        error_invalid_sections: 'Invalid sections parameter. Valid: tasks, departments, users.',

        empty_dept: '—',

        month_1: 'January',
        month_2: 'February',
        month_3: 'March',
        month_4: 'April',
        month_5: 'May',
        month_6: 'June',
        month_7: 'July',
        month_8: 'August',
        month_9: 'September',
        month_10: 'October',
        month_11: 'November',
        month_12: 'December',
    },
    daily_email: {
        subject: '[ETM] Daily summary — {{date}}',
        header_subtitle: 'Daily summary — {{date}}',
        greeting: 'Good morning, {{name}}!',
        intro: 'Here is the summary of your tasks for today:',
        section_overdue: 'OVERDUE ({{count}})',
        section_today: 'DUE TODAY ({{count}})',
        section_upcoming: 'DUE SOON ({{count}})',
        section_weekly: 'WEEKLY REMINDER ({{count}})',
        section_blocked: 'BLOCKED ({{count}})',
        days_overdue: '{{days}} days overdue',
        due_today_label: 'due today',
        due_in_days: 'due in {{days}} days ({{date}})',
        weekly_due_on: 'due on {{date}} (in {{days}} days)',
        blocked_reason_prefix: 'Reason',
        no_tasks: 'You have no active tasks today.',
        footer: 'This notification was generated automatically by ETM.',
        col_title: 'Task',
        col_due: 'Due',
        col_status: 'Status',
        col_post: 'Department',
    },
    notif_email: {
        greeting: 'Hi {{name}}!',
        cta_open_task: 'Open task',
        footer: 'This notification was generated automatically by ETM.',

        // Subjects
        subj_task_assigned: '[ETM] Task assigned — {{title}}',
        subj_task_reassigned: '[ETM] New task assigned — {{title}}',
        subj_comment: '[ETM] New comment — {{title}}',
        subj_mention: '[ETM] Mention — {{title}}',
        subj_reaction: '[ETM] Reaction {{reaction}} — {{title}}',
        subj_subtask_assigned: '[ETM] Subtask assigned — {{title}}',
        subj_subtask_completed: '[ETM] Subtask completed — {{title}}',
        subj_checklist_checked: '[ETM] Checklist checked — {{title}}',
        subj_status_changed: '[ETM] Status: {{status}} — {{title}}',
        subj_completion_report: '[ETM] Completion report — {{title}}',

        // Subtitles
        sub_task_assigned: 'Task assigned',
        sub_task_reassigned: 'New task assigned',
        sub_comment: 'New comment',
        sub_mention: 'New mention',
        sub_reaction: 'New reaction',
        sub_subtask_assigned: 'Subtask assigned',
        sub_subtask_completed: 'Subtask completed',
        sub_checklist_checked: 'Checklist item completed',
        sub_status_changed: 'Status changed → {{status}}',

        // Body lines
        body_user_assigned_new_task: '<strong>{{actor}}</strong> assigned you a new task:',
        body_user_assigned_task: '<strong>{{actor}}</strong> assigned you a task:',
        body_user_commented: '<strong>{{actor}}</strong> added a comment on the task:',
        body_user_mentioned_you: '<strong>{{actor}}</strong> mentioned you in a comment on the task:',
        body_user_reacted: '<strong>{{actor}}</strong> reacted {{reaction}} to your comment on the task:',
        body_user_assigned_subtask: '<strong>{{actor}}</strong> assigned you a subtask:',
        body_user_completed_subtask: '<strong>{{actor}}</strong> completed a subtask:',
        body_user_checked_item: '<strong>{{actor}}</strong> checked an item from the checklist:',
        body_user_changed_status: '<strong>{{actor}}</strong> changed the task status:',

        // Status labels
        status_de_rezolvat: 'To do',
        status_in_realizare: 'In progress',
        status_terminat: 'Completed',
        status_blocat: 'Blocked',
    },
};

const STRINGS: Record<ServerLocale, Dict> = { ro: RO, hu: HU, en: EN };

export function loadServerStrings(): Record<ServerLocale, Record<string, string>> {
    // Flatten each dictionary to a "report.title" -> "..." map so the return
    // type matches the public signature (Record<key, string>).
    const flatten = (d: Dict, prefix = ''): Record<string, string> => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(d)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                Object.assign(out, flatten(v, key));
            } else if (typeof v === 'string') {
                out[key] = v;
            }
        }
        return out;
    };
    return {
        ro: flatten(RO),
        hu: flatten(HU),
        en: flatten(EN),
    };
}

function lookup(dict: Dict, dottedKey: string): string {
    const parts = dottedKey.split('.');
    let cur: any = dict;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
            cur = cur[p];
        } else {
            return dottedKey;
        }
    }
    return typeof cur === 'string' ? cur : dottedKey;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
    if (!vars) return s;
    return s.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        const v = vars[name];
        return v === undefined || v === null ? '' : String(v);
    });
}

export function tServer(
    locale: ServerLocale,
    key: string,
    vars?: Record<string, string | number>
): string {
    const dict = STRINGS[locale] ?? STRINGS.ro;
    return interpolate(lookup(dict, key), vars);
}

/**
 * Normalize a free-form language tag to a supported ServerLocale.
 * Falls back to 'ro' (the legacy default) for anything unknown.
 */
export function pickLocale(input: string | null | undefined): ServerLocale {
    const v = (input || '').toLowerCase().slice(0, 2);
    if (v === 'hu' || v === 'en' || v === 'ro') return v;
    return 'ro';
}

/**
 * Format a date for display in the given locale.
 * - ro: "9 mai 2026"
 * - hu: "2026. május 9."
 * - en: "May 9, 2026"
 */
export function formatDateLocalized(date: Date | string, locale: ServerLocale): string {
    const d = new Date(date);
    const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Bucharest';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d).split('-');
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const dd = parseInt(parts[2], 10);
    const monthName = tServer(locale, `report.month_${m}`);
    if (locale === 'hu') {
        // Hungarian: "2026. május 9."
        return `${y}. ${monthName.toLowerCase()} ${dd}.`;
    }
    if (locale === 'en') {
        return `${monthName} ${dd}, ${y}`;
    }
    // ro
    return `${dd} ${monthName.toLowerCase()} ${y}`;
}
