// ==========================================
// Client-side type definitions
// Source of truth: server/src/types/index.ts
// Keep both files in sync when modifying.
// Client uses string for dates (JSON serialization)
// Client adds UI-specific fields (bg, border) to constants
// ==========================================
export type UserRole = 'superadmin' | 'admin' | 'manager' | 'user';
export type Department = 'departament_1' | 'departament_2' | 'departament_3' | 'departament_4' | 'departament_5' | 'departament_6' | 'departament_7';
export type TaskStatus = 'de_rezolvat' | 'in_realizare' | 'terminat' | 'blocat';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type AlertStatus = 'active' | 'resolved';
export type ActionType = 'created' | 'status_changed' | 'due_date_changed' | 'comment_added' | 'subtask_added' | 'subtask_completed' | 'subtask_assigned' | 'attachment_added' | 'label_changed' | 'recurring_created' | 'alert_added' | 'alert_resolved' | 'dependency_added' | 'dependency_removed' | 'dependency_resolved' | 'checklist_updated' | 'title_changed' | 'description_changed' | 'assigned_to_changed' | 'department_changed' | 'task_created' | 'task_duplicated' | 'task_deleted';

export interface User {
    id: string;
    microsoft_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    departments: Department[];
    role: UserRole;
}

export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    due_date: string;
    created_by: string;
    assigned_to: string | null;
    assigned_post_id: string | null;
    department_label: Department;
    created_at: string;
    updated_at: string;
    creator_name?: string;
    creator_avatar?: string | null;
    assignee_name?: string | null;
    assignee_avatar?: string | null;
    assignee_email?: string | null;
    subtask_total?: number;
    subtask_completed?: number;
    last_activity?: string | null;
    is_recurring?: boolean;
    recurring_frequency?: RecurringFrequency;
    blocked_reason?: string | null;
    department?: Department | null;
    dependency_count?: number;
    blocks_count?: number;
    // Post-related fields
    assigned_post_name?: string;
    assigned_section_name?: string;
    assigned_department_name?: string;
}

export interface TaskDependency {
    id: string;
    blocking_task_id: string;
    blocked_task_id: string;
    blocking_task_title?: string;
    blocked_task_title?: string;
    blocking_task_status?: TaskStatus;
    blocked_task_status?: TaskStatus;
    created_by: string;
    creator_name?: string;
    created_at: string;
}

export interface ChecklistItem {
    id: string;
    task_id: string;
    title: string;
    is_checked: boolean;
    order_index: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface TaskAlert {
    id: string;
    task_id: string;
    created_by: string;
    creator_name?: string;
    creator_avatar?: string | null;
    content: string;
    is_resolved: boolean;
    resolved_by: string | null;
    resolved_by_name?: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface TaskDetail extends Task {
    subtasks: Subtask[];
    comments: TaskComment[];
    attachments: TaskAttachment[];
    activity: ActivityLogEntry[];
    alerts: TaskAlert[];
    dependencies?: { blocks: TaskDependency[]; blocked_by: TaskDependency[] };
    checklist?: ChecklistItem[];
}

export interface Subtask {
    id: string;
    task_id: string;
    title: string;
    is_completed: boolean;
    assigned_to: string | null;
    assigned_to_name?: string;
    assigned_to_avatar?: string | null;
    order_index: number;
    due_date?: string | null;
    priority?: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
}

export interface TaskComment {
    id: string;
    task_id: string;
    author_id: string;
    author_name?: string;
    author_avatar?: string | null;
    content: string;
    mentions: string[];
    reactions: { user_id: string; display_name: string; reaction: string }[];
    parent_comment_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface TaskAttachment {
    id: string;
    task_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    uploaded_by: string;
    uploader_name?: string;
    created_at: string;
}

export interface ActivityLogEntry {
    id: string;
    task_id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string | null;
    action_type: ActionType;
    details: Record<string, any>;
    created_at: string;
}

export interface DashboardStats {
    active: number;
    overdue: number;
    blocked: number;
    completed_this_month: number;
    total: number;
}

export interface DashboardCharts {
    status_distribution: { status: TaskStatus; count: string }[];
    department_distribution: { department_label: Department; count: string }[];
    completion_trend: { week_start: string; week_end: string; count: number; label: string }[];
    urgent_tasks: Task[];
}

export interface TaskFilters {
    status?: string;
    department?: string;
    search?: string;
    period?: string;
    recurring?: string;
    assigned_to?: string;
    my_tasks?: string;
    exclude_status?: string;
    page?: number;
    limit?: number;
}

// Constants
export const DEPARTMENTS: Record<Department, { label: string; color: string; bg: string; border: string }> = {
    departament_1: { label: 'Comunicare si HR', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.4)' },
    departament_2: { label: 'Vanzari', color: '#A855F7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)' },
    departament_3: { label: 'Financiar', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
    departament_4: { label: 'Productie', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
    departament_5: { label: 'Calitate', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.4)' },
    departament_6: { label: 'Extindere', color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)' },
    departament_7: { label: 'Administrativ', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },
};

export const STATUSES: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
    de_rezolvat: { label: 'De rezolvat', color: '#60A5FA', bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.4)' },
    in_realizare: { label: 'În realizare', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' },
    terminat: { label: 'Terminat', color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.4)' },
    blocat: { label: 'Blocat', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' },
};

export const FREQUENCIES: Record<RecurringFrequency, string> = {
    daily: 'Zilnic',
    weekly: 'Săptămânal',
    biweekly: 'Bisăptămânal',
    monthly: 'Lunar',
    quarterly: 'Trimestrial',
    yearly: 'Anual',
};

// --- ORG STRUCTURE TYPES (Department → Section → Post) ---

export type PolicyScope = 'COMPANY' | 'DEPARTMENT' | 'POST';

export interface OrgDepartment {
    id: string;
    name: string;
    sort_order: number;
    color: string;
    head_user_id: string | null;
    head_user_name?: string;
    pfv: string | null;
    statistic_name: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    sections?: OrgSection[];
    policy_count?: number;
}

export interface OrgSection {
    id: string;
    name: string;
    department_id: string;
    head_user_id: string | null;
    head_user_name?: string;
    pfv: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    posts?: OrgPost[];
    department_name?: string;
}

export interface OrgPost {
    id: string;
    name: string;
    section_id: string;
    user_id: string | null;
    user_name?: string;
    user_email?: string;
    user_avatar?: string | null;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    section_name?: string;
    department_name?: string;
    department_id?: string;
    task_count?: number;
    policy_count?: number;
}

export interface Policy {
    id: string;
    directive_number: number | null;
    title: string;
    date: string;
    content_html: string;
    scope: PolicyScope;
    created_by_id: string | null;
    creator_name?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    departments?: { id: string; name: string }[];
    posts?: { id: string; name: string }[];
}

export interface Setting {
    id: string;
    key: string;
    value: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

// --- PAYMENT MODULE TYPES ---

export type PaymentCategory =
    | 'stat'
    | 'partener_furnizor'
    | 'furnizor_servicii'
    | 'furnizor_echipamente'
    | 'marketing'
    | 'salarii'
    | 'incasare_client'
    | 'alte_venituri';

export type PaymentStatus = 'de_platit' | 'platit';

export type PaymentActionType =
    | 'created'
    | 'marked_paid'
    | 'date_changed'
    | 'comment_added'
    | 'recurring_created'
    | 'category_changed'
    | 'payment_deleted';

export interface Payment {
    id: string;
    title: string;
    amount: string | number;
    currency: string;
    category: PaymentCategory;
    beneficiary_name: string | null;
    due_date: string;
    status: PaymentStatus;
    paid_at: string | null;
    paid_by: string | null;
    is_recurring: boolean;
    recurring_frequency: RecurringFrequency | null;
    recurring_next_date: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface PaymentWithDetails extends Payment {
    creator_name?: string;
    creator_avatar?: string | null;
    payer_name?: string | null;
    payer_avatar?: string | null;
}

export interface PaymentComment {
    id: string;
    payment_id: string;
    author_id: string;
    author_name?: string;
    author_avatar?: string | null;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface PaymentActivityLogEntry {
    id: string;
    payment_id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string | null;
    action_type: PaymentActionType;
    details: Record<string, any>;
    created_at: string;
}

export const PAYMENT_CATEGORIES: Record<PaymentCategory, { label: string; color: string }> = {
    stat: { label: 'Stat (ANAF, taxe, impozite)', color: '#DC2626' },
    partener_furnizor: { label: 'Partener / Furnizor', color: '#2563EB' },
    furnizor_servicii: { label: 'Furnizor de servicii', color: '#7C3AED' },
    furnizor_echipamente: { label: 'Furnizor de echipamente', color: '#0891B2' },
    marketing: { label: 'Marketing / Publicitate', color: '#EA580C' },
    salarii: { label: 'Salarii / Personal', color: '#16A34A' },
    incasare_client: { label: 'Încasare client', color: '#059669' },
    alte_venituri: { label: 'Alte venituri', color: '#0D9488' },
};

export interface WidgetConfig {
    widget_id: string;
    visible: boolean;
    order: number;
    size: 'full' | 'half';
}

export const AVAILABLE_WIDGETS: Record<string, { label: string; description: string; adminOnly?: boolean }> = {
    global_stats: { label: 'Statistici globale', description: 'Numărul total de sarcini active, restante, blocate și completate' },
    my_stats: { label: 'Sarcinile mele', description: 'Statisticile sarcinilor tale personale' },
    status_chart: { label: 'Distribuție status', description: 'Grafic cu distribuția statusurilor sarcinilor' },
    dept_chart: { label: 'Distribuție departamente', description: 'Grafic pe departamente' },
    trend_chart: { label: 'Trend completare', description: 'Graficul completărilor din ultimele 4 săptămâni' },
    urgent_tasks: { label: 'Sarcini urgente', description: 'Top 10 sarcini cu termen apropiat' },
    active_alerts: { label: 'Alerte active', description: 'Alertele nerezolvate din sistem' },
    bottlenecks: { label: 'Blocaje critice', description: 'Sarcinile care blochează cele mai multe altele' },
    payment_summary: { label: 'Sumar plăți', description: 'Rezumatul plăților lunii curente', adminOnly: true },
    calendar: { label: 'Calendar', description: 'Vizualizare calendar cu termenele sarcinilor' },
};

export type WebhookEventType =
    | 'task.created'
    | 'task.completed'
    | 'task.status_changed'
    | 'task.assigned'
    | 'task.overdue'
    | 'payment.due_soon'
    | 'payment.overdue'
    | 'payment.paid';

export type WebhookDeliveryStatus = 'pending' | 'sending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookSubscription {
    id: string;
    url: string;
    event_type: WebhookEventType;
    secret: string | null;
    description: string | null;
    is_active: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    creator_name?: string;
    success_count?: number;
    fail_count?: number;
    last_success?: string | null;
}

export interface WebhookDelivery {
    id: string;
    subscription_id: string;
    event_type: WebhookEventType;
    payload: Record<string, any>;
    response_status: number | null;
    response_body: string | null;
    attempt: number;
    max_attempts: number;
    status: WebhookDeliveryStatus;
    next_retry_at: string | null;
    error_message: string | null;
    delivered_at: string | null;
    created_at: string;
    url?: string;
    subscription_description?: string;
}

