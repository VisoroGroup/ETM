import axios from 'axios';
import { Task, TaskDetail, TaskFilters, DashboardStats, DashboardCharts, User, Subtask, SubtaskComment, SubtaskAttachment, TaskComment, TaskAttachment, TaskAlert, OrgDepartment, OrgSection, OrgPost, Policy, Company, PlannerWeekResponse, PlannerMonthResponse, PlannerCompanyWeekResponse, PlannerCompanyMonthResponse } from '../types';
import { safeLocalStorage } from '../utils/storage';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

const ACTIVE_COMPANY_KEY = 'visoro_active_company_id';

export function getActiveCompanyId(): number | null {
    const raw = safeLocalStorage.get(ACTIVE_COMPANY_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
}

// AbortController used to cancel ALL in-flight requests when the active company
// changes. Without this, a request that started under company A could resolve
// AFTER the user switched to company B and overwrite B's UI with A's data.
let companyAbortController = new AbortController();

export function setActiveCompanyId(id: number | null): void {
    const previous = getActiveCompanyId();
    if (id == null) safeLocalStorage.remove(ACTIVE_COMPANY_KEY);
    else safeLocalStorage.set(ACTIVE_COMPANY_KEY, String(id));
    // Abort everything in-flight under the previous company, then mint a
    // fresh controller for new requests.
    if (previous !== id) {
        companyAbortController.abort('active-company-change');
        companyAbortController = new AbortController();
        // Notify same-tab listeners (storage event only fires cross-tab) so
        // company-scoped caches like the users dropdown can refresh.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('etm:active-company-changed', { detail: id }));
        }
    }
}

// Add auth token + active company + cancel signal to requests
api.interceptors.request.use((config) => {
    const token = safeLocalStorage.get('visoro_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const activeCompanyId = getActiveCompanyId();
    if (activeCompanyId != null) {
        config.headers['X-Active-Company'] = String(activeCompanyId);
    }
    // Tag every request with the company-change abort signal unless the
    // caller explicitly provided their own. Lets us cancel every in-flight
    // request the instant the user switches companies.
    if (!config.signal) {
        config.signal = companyAbortController.signal;
    }
    return config;
});

// Auto-logout on expired/invalid token
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
            safeLocalStorage.remove('visoro_token');
            window.location.href = '/';
        }
        return Promise.reject(err);
    }
);

// Auth
export const authApi = {
    login: (data: any) => api.post('/auth/login', data).then(r => r.data),
    me: () => api.get<{ user: User }>('/auth/me').then(r => r.data),
    users: () => api.get<User[]>('/auth/users').then(r => r.data),
    // Magic link: request a link by email. Server always returns 200 (no
    // enumeration leak) — we just show a "check your inbox" message.
    requestMagicLink: (email: string) =>
        api.post<{ ok: true }>('/auth/magic-link/request', { email }).then(r => r.data),
    // Magic link: verify the token we got from the email URL. On success
    // returns a 30-day JWT.
    verifyMagicLink: (token: string) =>
        api.post<{ token: string; user: User }>('/auth/magic-link/verify', { token }).then(r => r.data),
};

// Tasks
export const tasksApi = {
    list: (filters?: TaskFilters) => api.get('/tasks', { params: filters }).then(r => r.data),
    get: (id: string) => api.get<TaskDetail>(`/tasks/${id}`).then(r => r.data),
    create: (data: Partial<Task>) => api.post<Task>('/tasks', data).then(r => r.data),
    update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data),
    changeStatus: (id: string, status: string, reason?: string) =>
        api.put(`/tasks/${id}/status`, { status, reason }).then(r => r.data),
    changeDueDate: (id: string, due_date: string, reason: string, realign_recurring = false) =>
        api.put(`/tasks/${id}/due-date`, { due_date, reason, realign_recurring }).then(r => r.data),
    delete: (id: string) => api.delete(`/tasks/${id}`).then(r => r.data),
    duplicate: (id: string) => api.post<Task>(`/tasks/${id}/duplicate`).then(r => r.data),
};

// Subtasks
export const subtasksApi = {
    create: (taskId: string, data: { title: string; assigned_to?: string | null }) =>
        api.post<Subtask>(`/tasks/${taskId}/subtasks`, data).then(r => r.data),
    update: (taskId: string, subtaskId: string, data: Partial<Subtask>) =>
        api.put<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, data).then(r => r.data),
    reorder: (taskId: string, order: { id: string; order_index: number }[]) =>
        api.put(`/tasks/${taskId}/subtasks-reorder`, { order }).then(r => r.data),
    delete: (taskId: string, subtaskId: string) =>
        api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`).then(r => r.data),

    // Comments on subtasks (Hungary uses subtasks as the unit of work).
    listComments: (taskId: string, subtaskId: string) =>
        api.get<SubtaskComment[]>(`/tasks/${taskId}/subtasks/${subtaskId}/comments`).then(r => r.data),
    addComment: (taskId: string, subtaskId: string, content: string) =>
        api.post<SubtaskComment>(`/tasks/${taskId}/subtasks/${subtaskId}/comments`, { content }).then(r => r.data),
    deleteComment: (taskId: string, subtaskId: string, commentId: string) =>
        api.delete(`/tasks/${taskId}/subtasks/${subtaskId}/comments/${commentId}`).then(r => r.data),

    // Attachments on subtasks. Upload still goes through /api/upload (parent
    // task scope) to leverage existing virus scan + size limits; this just
    // registers the file metadata against the subtask.
    listAttachments: (taskId: string, subtaskId: string) =>
        api.get<SubtaskAttachment[]>(`/tasks/${taskId}/subtasks/${subtaskId}/attachments`).then(r => r.data),
    registerAttachment: (taskId: string, subtaskId: string, data: { file_name: string; file_url: string; file_size: number }) =>
        api.post<SubtaskAttachment>(`/tasks/${taskId}/subtasks/${subtaskId}/attachments`, data).then(r => r.data),
    deleteAttachment: (taskId: string, subtaskId: string, attachmentId: string) =>
        api.delete(`/tasks/${taskId}/subtasks/${subtaskId}/attachments/${attachmentId}`).then(r => r.data),
};

// Comments
export const commentsApi = {
    list: (taskId: string) => api.get<TaskComment[]>(`/tasks/${taskId}/comments`).then(r => r.data),
    create: (taskId: string, content: string, mentions: string[], parentCommentId?: string | null) =>
        api.post<TaskComment>(`/tasks/${taskId}/comments`, { content, mentions, parent_comment_id: parentCommentId || null }).then(r => r.data),
    update: (taskId: string, commentId: string, content: string) =>
        api.put<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content }).then(r => r.data),
    delete: (taskId: string, commentId: string) =>
        api.delete(`/tasks/${taskId}/comments/${commentId}`).then(r => r.data),
    toggleReaction: (taskId: string, commentId: string, reaction = '\ud83d\udc4d') =>
        api.post(`/tasks/${taskId}/comments/${commentId}/react`, { reaction }).then(r => r.data),
};

// Attachments
export const attachmentsApi = {
    upload: (taskId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<TaskAttachment>(`/upload/${taskId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data);
    },
    delete: (taskId: string, attachmentId: string) =>
        api.delete(`/tasks/${taskId}/attachments/${attachmentId}`).then(r => r.data),
};

// User Preferences
export const userPreferencesApi = {
    get: () => api.get('/user-preferences').then(r => r.data),
    save: (prefs: Record<string, any>) => api.put('/user-preferences', prefs).then(r => r.data),
};

// Dashboard
export const dashboardApi = {
    stats: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    charts: () => api.get<DashboardCharts>('/dashboard/charts').then(r => r.data),
    activeAlerts: () => api.get<any[]>('/dashboard/active-alerts').then(r => r.data),
    myStats: () => api.get<any>('/dashboard/my-stats').then(r => r.data),
    bottlenecks: () => api.get<any[]>('/dashboard/bottlenecks').then(r => r.data),
    calendarEvents: () => api.get<any[]>('/dashboard/calendar-events').then(r => r.data),
    getPreferences: () => api.get('/dashboard/preferences').then(r => r.data),
    savePreferences: (widget_layout: any[]) => api.put('/dashboard/preferences', { widget_layout }).then(r => r.data),
};

// Dependencies
export const dependenciesApi = {
    list: (taskId: string) =>
        api.get(`/tasks/${taskId}/dependencies`).then(r => r.data),
    add: (taskId: string, data: { blocking_task_id: string; blocked_task_id: string }) =>
        api.post(`/tasks/${taskId}/dependencies`, data).then(r => r.data),
    remove: (taskId: string, depId: string) =>
        api.delete(`/tasks/${taskId}/dependencies/${depId}`).then(r => r.data),
};

// Checklist
export const checklistApi = {
    list: (taskId: string) => api.get(`/tasks/${taskId}/checklist`).then(r => r.data),
    add: (taskId: string, title: string) => api.post(`/tasks/${taskId}/checklist`, { title }).then(r => r.data),
    update: (taskId: string, itemId: string, data: { title?: string; is_checked?: boolean }) =>
        api.put(`/tasks/${taskId}/checklist/${itemId}`, data).then(r => r.data),
    remove: (taskId: string, itemId: string) => api.delete(`/tasks/${taskId}/checklist/${itemId}`).then(r => r.data),
    reorder: (taskId: string, order: { id: string; order_index: number }[]) =>
        api.put(`/tasks/${taskId}/checklist-reorder`, { order }).then(r => r.data),
};

// Recurring
export const recurringApi = {
    set: (taskId: string, frequency: string, workdays_only: boolean = false) =>
        api.post(`/tasks/${taskId}/recurring`, { frequency, workdays_only }).then(r => r.data),
    remove: (taskId: string) =>
        api.delete(`/tasks/${taskId}/recurring`).then(r => r.data),
};

// Activity
export const activityApi = {
    list: (taskId: string) => api.get(`/tasks/${taskId}/activity`).then(r => r.data),
};

// Activity Feed (global)
export const activityFeedApi = {
    list: (params?: { user_id?: string; department?: string; action_type?: string; page?: number; limit?: number }) =>
        api.get('/activity-feed', { params }).then(r => r.data),
};

// Alerts (În Atenție)
export const alertsApi = {
    list: (taskId: string) => api.get<TaskAlert[]>(`/tasks/${taskId}/alerts`).then(r => r.data),
    create: (taskId: string, content: string) =>
        api.post<TaskAlert>(`/tasks/${taskId}/alerts`, { content }).then(r => r.data),
    resolve: (taskId: string, alertId: string) =>
        api.put<TaskAlert>(`/tasks/${taskId}/alerts/${alertId}/resolve`, {}).then(r => r.data),
    delete: (taskId: string, alertId: string) =>
        api.delete(`/tasks/${taskId}/alerts/${alertId}`).then(r => r.data),
};

// Saved Filters
export const savedFiltersApi = {
    list: () => api.get('/saved-filters').then(r => r.data),
    create: (name: string, page: string, filter_config: any) =>
        api.post('/saved-filters', { name, page, filter_config }).then(r => r.data),
    delete: (id: string) => api.delete(`/saved-filters/${id}`).then(r => r.data),
};

// Admin
export const adminApi = {
    users: () => api.get('/admin/users').then(r => r.data),
    createUser: (data: { email: string; display_name: string; role?: string; departments?: string[]; company_ids?: number[] }) =>
        api.post('/admin/users', data).then(r => r.data),
    sendMagicLink: (userId: string) =>
        api.post<{ ok: true }>(`/admin/users/${userId}/send-magic-link`).then(r => r.data),
    updateUser: (id: string, data: { role?: string; departments?: string[]; email?: string }) =>
        api.patch(`/admin/users/${id}`, data).then(r => r.data),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(r => r.data),
    stats: () => api.get('/admin/stats').then(r => r.data),
    uploadUserAvatar: (userId: string, file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);
        return api.post(`/admin/users/${userId}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data);
    },
};

// API Tokens
export const apiTokensApi = {
    list: () => api.get('/admin/api-tokens').then(r => r.data),
    generate: (name: string) => api.post('/admin/api-tokens', { name }).then(r => r.data),
    revoke: (id: string) => api.delete(`/admin/api-tokens/${id}`).then(r => r.data),
};

// Profile
export const profileApi = {
    get: () => api.get('/profile').then(r => r.data),
    update: (data: { display_name?: string; avatar_url?: string | null }) =>
        api.patch('/profile', data).then(r => r.data),
    uploadAvatar: (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);
        return api.post('/profile/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data);
    },
    deleteAvatar: () => api.delete('/profile/avatar').then(r => r.data),
};

// Notifications
export const notificationsApi = {
    list: () => api.get('/notifications').then(r => r.data),
    unreadCount: () => api.get('/notifications/unread-count').then(r => r.data),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`, {}).then(r => r.data),
    markAllRead: () => api.patch('/notifications/read-all', {}).then(r => r.data),
    markReadForTask: (taskId: string, types: string[]) =>
        api.patch(`/notifications/read-for-task/${taskId}`, { types }).then(r => r.data),
};

// Emails / Email Logs
export const emailApi = {
    logs: () => api.get('/emails/logs').then(r => r.data),
    myLogs: () => api.get('/emails/logs/my').then(r => r.data),
    sendTest: (to?: string) => api.post('/emails/test', { to }).then(r => r.data),
};

// Templates
export const templatesApi = {
    list: () => api.get('/templates').then(r => r.data),
    create: (data: { title: string; description?: string; department_label: string; assigned_to?: string | null; subtasks?: { title: string }[] }) =>
        api.post('/templates', data).then(r => r.data),
    delete: (id: string) => api.delete(`/templates/${id}`).then(r => r.data),
    use: (id: string, due_date: string) => api.post(`/templates/${id}/use`, { due_date }).then(r => r.data),
};

export const webhookApi = {
    getAll: () => api.get('/webhooks').then(r => r.data),
    create: (data: { url: string; event_type: string; secret?: string; description?: string }) =>
        api.post('/webhooks', data).then(r => r.data),
    update: (id: string, data: any) => api.put(`/webhooks/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/webhooks/${id}`),
    test: (id: string) => api.post(`/webhooks/${id}/test`).then(r => r.data),
    getDeliveries: (params?: { event_type?: string; status?: string; subscription_id?: string; limit?: number; offset?: number }) =>
        api.get('/webhooks/deliveries', { params }).then(r => r.data),
};
// Day View (all authenticated company members)
export const dayViewApi = {
    get: (date: string) => api.get(`/day-view`, { params: { date } }).then(r => r.data),
    downloadPdf: async (userId: string, date: string) => {
        const res = await api.get(`/day-view/pdf/${userId}`, {
            params: { date },
            responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasks_${date}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    },
};

// Planner (Planificare săptămânală / lunară, PRP 004). The plan is a separate
// layer over tasks — adding a task here never changes its due_date. Tenant
// scoping (X-Active-Company) is applied automatically by the request
// interceptor above, so every call only ever touches the active company's plan.
export const plannerApi = {
    // `start` is the Monday of the target week (YYYY-MM-DD); `month` is YYYY-MM.
    getWeek: (start: string) =>
        api.get<PlannerWeekResponse>('/planner/week', { params: { start } }).then(r => r.data),
    getMonth: (month: string) =>
        api.get<PlannerMonthResponse>('/planner/month', { params: { month } }).then(r => r.data),
    addToWeek: (start: string, task_ids: string[]) =>
        api.post<{ added: number }>('/planner/week', { start, task_ids }).then(r => r.data),
    addToMonth: (month: string, task_ids: string[]) =>
        api.post<{ added: number }>('/planner/month', { month, task_ids }).then(r => r.data),
    removeFromWeek: (taskId: string, start: string) =>
        api.delete<{ removed: number }>(`/planner/week/${taskId}`, { params: { start } }).then(r => r.data),
    removeFromMonth: (taskId: string, month: string) =>
        api.delete<{ removed: number }>(`/planner/month/${taskId}`, { params: { month } }).then(r => r.data),
    // Company overview — server gates these on a user-id whitelist (403 otherwise).
    getCompanyWeek: (start: string) =>
        api.get<PlannerCompanyWeekResponse>('/planner/company/week', { params: { start } }).then(r => r.data),
    getCompanyMonth: (month: string) =>
        api.get<PlannerCompanyMonthResponse>('/planner/company/month', { params: { month } }).then(r => r.data),
    // Whether the current user may see the company overview switch at all.
    canViewCompany: () =>
        api.get<{ allowed: boolean }>('/planner/can-view-company').then(r => r.data),
};

// Org Structure (Departments → Sections → Posts)
export const departmentsApi = {
    list: () => api.get<{ departments: OrgDepartment[]; company_policy_count: number }>('/departments').then(r => r.data),
    get: (id: string) => api.get<OrgDepartment>(`/departments/${id}`).then(r => r.data),
    create: (data: Partial<OrgDepartment>) => api.post<OrgDepartment>('/departments', data).then(r => r.data),
    update: (id: string, data: Partial<OrgDepartment>) => api.put<OrgDepartment>(`/departments/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/departments/${id}`).then(r => r.data),
};

export const sectionsApi = {
    list: (departmentId: string) => api.get<OrgSection[]>(`/departments/${departmentId}/sections`).then(r => r.data),
    create: (departmentId: string, data: Partial<OrgSection>) => api.post<OrgSection>(`/departments/${departmentId}/sections`, data).then(r => r.data),
    update: (id: string, data: Partial<OrgSection>) => api.put<OrgSection>(`/departments/sections/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/departments/sections/${id}`).then(r => r.data),
};

export const postsApi = {
    list: (sectionId: string) => api.get<OrgPost[]>(`/departments/sections/${sectionId}/posts`).then(r => r.data),
    get: (id: string) => api.get<OrgPost>(`/departments/posts/${id}`).then(r => r.data),
    create: (sectionId: string, data: Partial<OrgPost>) => api.post<OrgPost>(`/departments/sections/${sectionId}/posts`, data).then(r => r.data),
    update: (id: string, data: Partial<OrgPost>) => api.put<OrgPost>(`/departments/posts/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/departments/posts/${id}`).then(r => r.data),
};

// Policies (Directives)
export const policiesApi = {
    list: (params?: { scope?: string; department_id?: string; post_id?: string }) =>
        api.get<Policy[]>('/policies', { params }).then(r => r.data),
    get: (id: string) => api.get<Policy>(`/policies/${id}`).then(r => r.data),
    upload: (formData: FormData) =>
        api.post<Policy>('/policies/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),
    update: (id: string, data: Partial<Policy>) => api.put<Policy>(`/policies/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/policies/${id}`).then(r => r.data),
};

// Company Settings
export const settingsApi = {
    getCompanyGoal: () => api.get<{ goal: string }>('/settings/company-goal').then(r => r.data),
    updateCompanyGoal: (goal: string) => api.put<{ goal: string }>('/settings/company-goal', { goal }).then(r => r.data),
    getHolidays: () => api.get<{ holidays: string[] }>('/settings/holidays').then(r => r.data),
};

// Global search
export interface GlobalSearchResult {
    tasks: any[];
    comments: any[];
    attachments: any[];
    policies: any[];
    users: any[];
    posts: any[];
    sections: any[];
    departments: any[];
    total: number;
}
export const searchApi = {
    search: (q: string, limit = 10) =>
        api.get<GlobalSearchResult>('/search', { params: { q, limit } }).then(r => r.data),
};

// Orphan tasks — triage list for admins
export interface OrphanTask {
    id: string;
    title: string;
    status: string;
    department_label: string;
    due_date: string;
    created_at: string;
    assigned_to: string | null;
    assignee_name: string | null;
    assignee_avatar: string | null;
    created_by: string;
    // Server returns NULL when the creator was hard-deleted (LEFT JOIN).
    creator_name: string | null;
    creator_avatar: string | null;
    is_recurring_template: boolean;
}
export const orphanTasksApi = {
    list: () => api.get<{ tasks: OrphanTask[]; total: number }>('/orphan-tasks').then(r => r.data),
};

// Companies (multi-tenant)
export const companiesApi = {
    list: () => api.get<{ companies: Company[] }>('/companies').then(r => r.data),
};

// Admin Companies (superadmin manages, admin reads)
export interface AdminCompanyInput {
    name: string;
    sidebar_name: string;
    slug?: string;
    language: 'ro' | 'hu' | 'en';
    template_type: 'full' | 'project' | 'simple';
    color: string;
    icon?: string | null;
}
export const adminCompaniesApi = {
    list: () => api.get<{ companies: Company[] }>('/admin/companies').then(r => r.data),
    create: (data: AdminCompanyInput) => api.post<{ company: Company }>('/admin/companies', data).then(r => r.data),
    update: (id: number, data: Partial<AdminCompanyInput> & { sort_order?: number }) =>
        api.put<{ company: Company }>(`/admin/companies/${id}`, data).then(r => r.data),
    archive: (id: number, archive: boolean) =>
        api.patch<{ company: Company }>(`/admin/companies/${id}/archive`, { archive }).then(r => r.data),
};

// Extends adminApi with company-access management
export const adminUserCompaniesApi = {
    setUserCompanies: (userId: string, companyIds: number[]) =>
        api.put(`/admin/users/${userId}/companies`, { company_ids: companyIds }).then(r => r.data),
};

// PUG (Visoro Neo Plan) — admin catalogs + project CRUD
export interface PugStage {
    id: string;
    name: string;
    icon: string | null;
    color: string;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
}
export interface PugStatus {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    is_initial: boolean;
    is_terminal: boolean;
    is_active: boolean;
}
export interface PugWorkType {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}
export interface PugCustomField {
    id: string;
    name: string;
    field_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    options: any;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
}
export interface PugReminderLevel {
    id: string;
    days_before: number;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface PugProject {
    id: string;
    title: string;
    work_type_id: string | null;
    work_type_name: string | null;
    client_name: string | null;
    location: string | null;
    contract_number: string | null;
    contract_date: string | null;
    contract_amount: string | null;
    contract_currency: string | null;
    area_hectares: string | null;
    start_date: string | null;
    deadline: string | null;
    notes: string | null;
    is_archived: boolean;
    status: 'new' | 'active' | 'closed';
    responsibles: { id: string; display_name: string; avatar_url: string | null; email: string }[];
    created_at: string;
    updated_at: string;
}
export const pugAdminApi = {
    listStages: () => api.get<{ stages: PugStage[] }>('/admin/pug/stages').then(r => r.data),
    createStage: (data: Partial<PugStage>) => api.post<{ stage: PugStage }>('/admin/pug/stages', data).then(r => r.data),
    updateStage: (id: string, data: Partial<PugStage>) => api.put<{ stage: PugStage }>(`/admin/pug/stages/${id}`, data).then(r => r.data),
    deleteStage: (id: string) => api.delete(`/admin/pug/stages/${id}`).then(r => r.data),
    listStatuses: () => api.get<{ statuses: PugStatus[] }>('/admin/pug/statuses').then(r => r.data),
    createStatus: (data: Partial<PugStatus>) => api.post<{ status: PugStatus }>('/admin/pug/statuses', data).then(r => r.data),
    updateStatus: (id: string, data: Partial<PugStatus>) => api.put<{ status: PugStatus }>(`/admin/pug/statuses/${id}`, data).then(r => r.data),
    deleteStatus: (id: string) => api.delete(`/admin/pug/statuses/${id}`).then(r => r.data),
    listWorkTypes: () => api.get<{ work_types: PugWorkType[] }>('/admin/pug/work-types').then(r => r.data),
    createWorkType: (data: Partial<PugWorkType>) => api.post<{ work_type: PugWorkType }>('/admin/pug/work-types', data).then(r => r.data),
    updateWorkType: (id: string, data: Partial<PugWorkType>) => api.put<{ work_type: PugWorkType }>(`/admin/pug/work-types/${id}`, data).then(r => r.data),
    deleteWorkType: (id: string) => api.delete(`/admin/pug/work-types/${id}`).then(r => r.data),
    listCustomFields: () => api.get<{ fields: PugCustomField[] }>('/admin/pug/custom-fields').then(r => r.data),
    createCustomField: (data: Partial<PugCustomField>) => api.post<{ field: PugCustomField }>('/admin/pug/custom-fields', data).then(r => r.data),
    updateCustomField: (id: string, data: Partial<PugCustomField>) => api.put<{ field: PugCustomField }>(`/admin/pug/custom-fields/${id}`, data).then(r => r.data),
    deleteCustomField: (id: string) => api.delete(`/admin/pug/custom-fields/${id}`).then(r => r.data),
    listReminderLevels: () => api.get<{ levels: PugReminderLevel[] }>('/admin/pug/reminder-levels').then(r => r.data),
    createReminderLevel: (data: { days_before: number; is_enabled?: boolean }) =>
        api.post<{ level: PugReminderLevel }>('/admin/pug/reminder-levels', data).then(r => r.data),
    updateReminderLevel: (id: string, data: { days_before?: number; is_enabled?: boolean }) =>
        api.put<{ level: PugReminderLevel }>(`/admin/pug/reminder-levels/${id}`, data).then(r => r.data),
    deleteReminderLevel: (id: string) => api.delete(`/admin/pug/reminder-levels/${id}`).then(r => r.data),

    // Project templates — reusable project recipes (architecture phase chains,
    // GPR survey workflow). Instantiate spawns a real project + stages.
    listTemplates: () => api.get<{ templates: PugProjectTemplate[] }>('/admin/pug/templates').then(r => r.data),
    createTemplate: (data: { name: string; description?: string; work_type_id?: string;
                              stages?: Array<{ stage_catalog_id: string; sort_order?: number; default_deadline_offset_days?: number | null }> }) =>
        api.post<PugProjectTemplate>('/admin/pug/templates', data).then(r => r.data),
    deleteTemplate: (id: string) => api.delete(`/admin/pug/templates/${id}`).then(r => r.data),
    instantiateTemplate: (id: string, data: { title: string; start_date?: string | null }) =>
        api.post<{ project_id: string }>(`/admin/pug/templates/${id}/instantiate`, data).then(r => r.data),
};

export interface PugProjectTemplate {
    id: string;
    name: string;
    description: string | null;
    work_type_id: string | null;
    work_type_name?: string | null;
    is_active: boolean;
    stage_count?: number;
    created_at: string;
}
export const pugProjectsApi = {
    list: (includeArchived = false) => api.get<{ projects: PugProject[] }>('/pug/projects', { params: { archived: includeArchived } }).then(r => r.data),
    get: (id: string) => api.get<{ project: any }>(`/pug/projects/${id}`).then(r => r.data),
    create: (data: any) => api.post<{ project_id: string }>('/pug/projects', data).then(r => r.data),
    update: (id: string, data: any) => api.put(`/pug/projects/${id}`, data).then(r => r.data),
    archive: (id: string, archive: boolean) => api.patch(`/pug/projects/${id}/archive`, { archive }).then(r => r.data),
    addStage: (projectId: string, data: any) => api.post<{ stage_id: string }>(`/pug/projects/${projectId}/stages`, data).then(r => r.data),
    updateStage: (projectId: string, stageId: string, data: any) => api.put(`/pug/projects/${projectId}/stages/${stageId}`, data).then(r => r.data),
    deleteStage: (projectId: string, stageId: string) => api.delete(`/pug/projects/${projectId}/stages/${stageId}`).then(r => r.data),
    setCustomFieldValues: (projectId: string, values: Record<string, any>) => api.put(`/pug/projects/${projectId}/custom-fields`, { values }).then(r => r.data),
    setResponsibles: (projectId: string, userIds: string[]) => api.put(`/pug/projects/${projectId}/responsibles`, { user_ids: userIds }).then(r => r.data),

    // Stage dependencies — phase sequencing for architecture / permit work.
    listStageDependencies: (projectId: string) =>
        api.get<PugStageDependency[]>(`/pug/projects/${projectId}/stage-dependencies`).then(r => r.data),
    addStageDependency: (projectId: string, data: { blocking_stage_id: string; blocked_stage_id: string }) =>
        api.post<PugStageDependency>(`/pug/projects/${projectId}/stage-dependencies`, data).then(r => r.data),
    removeStageDependency: (projectId: string, depId: string) =>
        api.delete(`/pug/projects/${projectId}/stage-dependencies/${depId}`).then(r => r.data),

    // Public share tokens — David sends one to the mayor's office, the
    // public /shared/:token URL renders a read-only project status.
    listShareTokens: (projectId: string) =>
        api.get<PugShareToken[]>(`/pug/projects/${projectId}/share-tokens`).then(r => r.data),
    createShareToken: (projectId: string, expiresAt?: string | null) =>
        api.post<PugShareToken>(`/pug/projects/${projectId}/share-tokens`, { expires_at: expiresAt ?? null }).then(r => r.data),
    revokeShareToken: (projectId: string, tokenId: string) =>
        api.delete(`/pug/projects/${projectId}/share-tokens/${tokenId}`).then(r => r.data),

    // Project-scoped attachments (architecture / GPR / survey deliverables
    // belong here, not on individual tasks).
    listAttachments: (projectId: string) =>
        api.get<PugProjectAttachment[]>(`/pug/projects/${projectId}/attachments`).then(r => r.data),
    registerAttachment: (projectId: string, data: { file_name: string; file_url: string; file_size: number }) =>
        api.post<PugProjectAttachment>(`/pug/projects/${projectId}/attachments`, data).then(r => r.data),
    deleteAttachment: (projectId: string, attachmentId: string) =>
        api.delete(`/pug/projects/${projectId}/attachments/${attachmentId}`).then(r => r.data),
};

export interface PugStageDependency {
    id: string;
    blocking_stage_id: string;
    blocked_stage_id: string;
    created_at: string;
}

export interface PugShareToken {
    id: string;
    token: string;
    created_at: string;
    expires_at: string | null;
    revoked_at?: string | null;
    last_viewed_at?: string | null;
    view_count: number;
}

export interface PugProjectAttachment {
    id: string;
    pug_project_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    uploaded_by: string;
    uploaded_by_name?: string;
    created_at: string;
    // Optional field-work metadata (migration 093). Present when the
    // browser had Geolocation permission at upload time — David's GPR
    // photos use this to pin sample locations on a map.
    geo_lat?: number | null;
    geo_lng?: number | null;
    geo_accuracy?: number | null;
    captured_at?: string | null;
}

export { api };
export default api;
