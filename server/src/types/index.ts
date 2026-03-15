// Shared TypeScript types for the Visoro Task Manager

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

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

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
    | 'alert_resolved';

export interface User {
    id: string;
    microsoft_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    department: Department;
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
    department_label: Department;
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
    de_rezolvat: { label: 'De rezolvat', color: '#94A3B8' },
    in_realizare: { label: 'În realizare', color: '#3B82F6' },
    terminat: { label: 'Terminat', color: '#10B981' },
    blocat: { label: 'Blocat', color: '#EF4444' },
};
