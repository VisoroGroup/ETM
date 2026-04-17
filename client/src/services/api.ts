import axios from 'axios';
import { Task, TaskDetail, TaskFilters, DashboardStats, DashboardCharts, User, Subtask, TaskComment, TaskAttachment, TaskAlert, OrgDepartment, OrgSection, OrgPost, Policy } from '../types';
import { safeLocalStorage } from '../utils/storage';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = safeLocalStorage.get('visoro_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
};

// Tasks
export const tasksApi = {
    list: (filters?: TaskFilters) => api.get('/tasks', { params: filters }).then(r => r.data),
    get: (id: string) => api.get<TaskDetail>(`/tasks/${id}`).then(r => r.data),
    create: (data: Partial<Task>) => api.post<Task>('/tasks', data).then(r => r.data),
    update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data),
    changeStatus: (id: string, status: string, reason?: string) =>
        api.put(`/tasks/${id}/status`, { status, reason }).then(r => r.data),
    changeDueDate: (id: string, due_date: string, reason: string) =>
        api.put(`/tasks/${id}/due-date`, { due_date, reason }).then(r => r.data),
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
    createUser: (data: { email: string; display_name: string; role?: string; departments?: string[] }) =>
        api.post('/admin/users', data).then(r => r.data),
    updateUser: (id: string, data: { role?: string; department?: string }) =>
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
// Day View (superadmin)
export const dayViewApi = {
    get: (date: string) => api.get(`/day-view`, { params: { date } }).then(r => r.data),
    getWeek: (start: string) => api.get(`/day-view/week`, { params: { start } }).then(r => r.data),
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
    creator_name: string;
    creator_avatar: string | null;
    is_recurring_template: boolean;
}
export const orphanTasksApi = {
    list: () => api.get<{ tasks: OrphanTask[]; total: number }>('/orphan-tasks').then(r => r.data),
};

export { api };
export default api;
