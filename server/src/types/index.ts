// ==========================================
// Server-side type definitions (SOURCE OF TRUTH)
// Client types: client/src/types/index.ts
// Keep both files in sync when modifying.
// ==========================================

export type UserRole = 'admin' | 'manager' | 'user';

export type Department =
    | 'departament_1'
    | 'departament_2'
    | 'departament_3'
    | 'departament_4'
    | 'departament_5'
    | 'departament_6'
    | 'departament_7';

export type TaskStatus = 'de_rezolvat' | 'in_realizare' | 'terminat' | 'blocat';

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type ActionType =
    | 'created'
    | 'status_changed'
    | 'due_date_changed'
    | 'comment_added'
    | 'subtask_added'
    | 'subtask_completed'
    | 'subtask_assigned'
    | 'attachment_added'
    | 'label_changed'
    | 'recurring_created'
    | 'alert_added'
    | 'alert_resolved'
    | 'dependency_added'
    | 'dependency_removed'
    | 'dependency_resolved'
    | 'checklist_updated'
    | 'title_changed'
    | 'description_changed'
    | 'assigned_to_changed'
    | 'department_changed'
    | 'task_created'
    | 'task_duplicated'
    | 'task_deleted';

export interface User {
    id: string;
    microsoft_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    departments: Department[];
    role: UserRole;
    created_at: Date;
    updated_at: Date;
}

export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    due_date: string;
    created_by: string;
    assigned_to: string | null;
    department_label: Department;
    created_at: Date;
    updated_at: Date;
    dependency_count?: number;
    blocks_count?: number;
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
    created_at: Date;
}

export interface ChecklistItem {
    id: string;
    task_id: string;
    title: string;
    is_checked: boolean;
    order_index: number;
    created_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface TaskWithDetails extends Task {
    creator_name: string;
    creator_avatar: string | null;
    subtask_total: number;
    subtask_completed: number;
    last_activity: Date | null;
    is_recurring: boolean;
    blocked_reason?: string;
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
    created_at: Date;
    updated_at: Date;
}

export interface TaskComment {
    id: string;
    task_id: string;
    author_id: string;
    author_name?: string;
    author_avatar?: string | null;
    content: string;
    mentions: string[];
    created_at: Date;
    updated_at: Date;
}

export interface TaskAttachment {
    id: string;
    task_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    uploaded_by: string;
    uploader_name?: string;
    created_at: Date;
}

export interface ActivityLogEntry {
    id: string;
    task_id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string | null;
    action_type: ActionType;
    details: Record<string, any>;
    created_at: Date;
}

export interface RecurringTask {
    id: string;
    template_task_id: string;
    frequency: RecurringFrequency;
    next_run_date: string;
    is_active: boolean;
    workdays_only: boolean;
    created_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface TaskStatusChange {
    id: string;
    task_id: string;
    old_status: TaskStatus;
    new_status: TaskStatus;
    reason: string | null;
    changed_by: string;
    created_at: Date;
}

export interface TaskDueDateChange {
    id: string;
    task_id: string;
    old_date: string;
    new_date: string;
    reason: string;
    changed_by: string;
    created_at: Date;
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
    resolved_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface EmailLog {
    id: string;
    user_id: string;
    task_ids: string[];
    email_type: 'daily_summary';
    sent_at: Date;
    status: 'sent' | 'failed';
    error_message: string | null;
}

// Department config
export const DEPARTMENTS: Record<Department, { label: string; color: string }> = {
    departament_1: { label: 'Comunicare si HR', color: '#3B82F6' },
    departament_2: { label: 'Vanzari', color: '#10B981' },
    departament_3: { label: 'Financiar', color: '#F59E0B' },
    departament_4: { label: 'Productie', color: '#EF4444' },
    departament_5: { label: 'Calitate', color: '#8B5CF6' },
    departament_6: { label: 'Extindere', color: '#EC4899' },
    departament_7: { label: 'Administrativ', color: '#06B6D4' },
};

// Status config
export const STATUSES: Record<TaskStatus, { label: string; color: string }> = {
    de_rezolvat: { label: 'De rezolvat', color: '#2563EB' },
    in_realizare: { label: 'În realizare', color: '#D97706' },
    terminat: { label: 'Terminat', color: '#10B981' },
    blocat: { label: 'Blocat', color: '#EF4444' },
};

// --- PAYMENT MODULE TYPES ---

export type PaymentCategory = 
    | 'stat' 
    | 'partener_furnizor' 
    | 'furnizor_servicii' 
    | 'furnizor_echipamente' 
    | 'marketing' 
    | 'salarii';

export type PaymentStatus = 'de_platit' | 'platit';

export type PaymentReminderType = 'day_30' | 'day_21' | 'day_14' | 'day_7' | 'day_0' | 'overdue';

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
    paid_at: Date | null;
    paid_by: string | null;
    is_recurring: boolean;
    recurring_frequency: RecurringFrequency | null;
    recurring_next_date: string | null;
    created_by: string;
    created_at: Date;
    updated_at: Date;
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
    created_at: Date;
    updated_at: Date;
}

export interface PaymentActivityLogEntry {
    id: string;
    payment_id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string | null;
    action_type: PaymentActionType;
    details: Record<string, any>;
    created_at: Date;
}

export interface PaymentReminder {
    id: string;
    payment_id: string;
    reminder_type: PaymentReminderType;
    scheduled_date: string;
    actual_sent_date: string;
    sent: boolean;
    sent_at: Date | null;
    created_at: Date;
}

export const PAYMENT_CATEGORIES: Record<PaymentCategory, { label: string; color: string }> = {
    stat: { label: 'Stat (ANAF, taxe, impozite)', color: '#DC2626' },
    partener_furnizor: { label: 'Partener / Furnizor', color: '#2563EB' },
    furnizor_servicii: { label: 'Furnizor de servicii', color: '#7C3AED' },
    furnizor_echipamente: { label: 'Furnizor de echipamente', color: '#0891B2' },
    marketing: { label: 'Marketing / Publicitate', color: '#EA580C' },
    salarii: { label: 'Salarii / Personal', color: '#16A34A' },
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
