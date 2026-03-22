import axios from 'axios';
import { Task, TaskDetail, TaskFilters, DashboardStats, DashboardCharts, User, Subtask, TaskComment, TaskAttachment, TaskAlert } from '../types';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('visoro_token');
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
            localStorage.removeItem('visoro_token');
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
    create: (taskId: string, content: string, mentions: string[]) =>
        api.post<TaskComment>(`/tasks/${taskId}/comments`, { content, mentions }).then(r => r.data),
    update: (taskId: string, commentId: string, content: string) =>
        api.put<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content }).then(r => r.data),
    delete: (taskId: string, commentId: string) =>
        api.delete(`/tasks/${taskId}/comments/${commentId}`).then(r => r.data),
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

// Dashboard
export const dashboardApi = {
    stats: () => api.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    charts: () => api.get<DashboardCharts>('/dashboard/charts').then(r => r.data),
    activeAlerts: () => api.get<any[]>('/dashboard/active-alerts').then(r => r.data),
    myStats: () => api.get<any>('/dashboard/my-stats').then(r => r.data),
    bottlenecks: () => api.get<any[]>('/dashboard/bottlenecks').then(r => r.data),
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
    updateUser: (id: string, data: { role?: string; department?: string }) =>
        api.patch(`/admin/users/${id}`, data).then(r => r.data),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(r => r.data),
    stats: () => api.get('/admin/stats').then(r => r.data),
};

// Profile
export const profileApi = {
    get: () => api.get('/profile').then(r => r.data),
    update: (data: { display_name?: string; avatar_url?: string | null }) =>
        api.patch('/profile', data).then(r => r.data),
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

export { api };
export default api;
