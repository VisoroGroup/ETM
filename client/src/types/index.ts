export type UserRole = 'admin' | 'manager' | 'user';
export type Department = 'departament_1' | 'departament_2' | 'departament_3' | 'departament_4' | 'departament_5' | 'departament_6' | 'departament_7';
export type TaskStatus = 'de_rezolvat' | 'in_realizare' | 'terminat' | 'blocat';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type AlertStatus = 'active' | 'resolved';
export type ActionType = 'created' | 'status_changed' | 'due_date_changed' | 'comment_added' | 'subtask_added' | 'subtask_completed' | 'subtask_assigned' | 'attachment_added' | 'label_changed' | 'recurring_created' | 'alert_added' | 'alert_resolved';

export interface User {
    id: string;
    microsoft_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    department: Department;
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
