import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, subtasksApi, commentsApi, recurringApi, alertsApi } from '../services/api';
import type { TaskDetail, TaskStatus, Department, Subtask, TaskComment, TaskAlert } from '../types';

const TASK_KEY = (id: string) => ['task-detail', id];

/**
 * Central hook for task detail fetching + optimistic mutations.
 * Replaces the manual loadTask() + setState pattern in TaskDrawer.
 */
export function useTaskDetail(taskId: string) {
    const queryClient = useQueryClient();

    // ---- Query ----
    const { data: task, isLoading: loading, refetch } = useQuery({
        queryKey: TASK_KEY(taskId),
        queryFn: () => tasksApi.get(taskId),
        staleTime: 5_000,
        refetchInterval: 5_000,   // poll every 5s so colleague comments appear live
    });

    // ---- Helpers ----
    function optimistic(updater: (old: TaskDetail) => TaskDetail) {
        queryClient.setQueryData<TaskDetail>(TASK_KEY(taskId), (old) => {
            if (!old) return old;
            return updater(old);
        });
    }

    function rollback(ctx: { previous?: TaskDetail }) {
        if (ctx.previous) {
            queryClient.setQueryData(TASK_KEY(taskId), ctx.previous);
        }
    }

    function snapshot(): { previous?: TaskDetail } {
        return { previous: queryClient.getQueryData<TaskDetail>(TASK_KEY(taskId)) };
    }

    // ---- Mutations ----

    // Status change
    const changeStatus = useMutation({
        mutationFn: ({ status, reason }: { status: TaskStatus; reason?: string }) =>
            tasksApi.changeStatus(taskId, status, reason),
        onMutate: async ({ status }) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({ ...old, status }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Update fields (title, description, department)
    const updateTask = useMutation({
        mutationFn: (data: Partial<Pick<TaskDetail, 'title' | 'description' | 'department_label'>>) =>
            tasksApi.update(taskId, data as any),
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({ ...old, ...data }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Toggle subtask completion
    const toggleSubtask = useMutation({
        mutationFn: ({ subtaskId, is_completed }: { subtaskId: string; is_completed: boolean }) =>
            subtasksApi.update(taskId, subtaskId, { is_completed }),
        onMutate: async ({ subtaskId, is_completed }) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({
                ...old,
                subtasks: old.subtasks.map(s =>
                    s.id === subtaskId ? { ...s, is_completed } : s
                ),
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Add subtask
    const addSubtask = useMutation({
        mutationFn: (data: { title: string; assigned_to?: string | null }) =>
            subtasksApi.create(taskId, data),
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            const tempSubtask: Subtask = {
                id: `temp-${Date.now()}`,
                task_id: taskId,
                title: data.title,
                is_completed: false,
                assigned_to: data.assigned_to || null,
                order_index: (task?.subtasks.length || 0),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            optimistic(old => ({
                ...old,
                subtasks: [...old.subtasks, tempSubtask],
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Delete subtask
    const deleteSubtask = useMutation({
        mutationFn: (subtaskId: string) =>
            subtasksApi.delete(taskId, subtaskId),
        onMutate: async (subtaskId) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({
                ...old,
                subtasks: old.subtasks.filter(s => s.id !== subtaskId),
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Update subtask (assign, priority, due_date)
    const updateSubtask = useMutation({
        mutationFn: ({ subtaskId, data }: { subtaskId: string; data: Partial<Subtask> }) =>
            subtasksApi.update(taskId, subtaskId, data as any),
        onMutate: async ({ subtaskId, data }) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({
                ...old,
                subtasks: old.subtasks.map(s =>
                    s.id === subtaskId ? { ...s, ...data } : s
                ),
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Add comment
    const addComment = useMutation({
        mutationFn: ({ content, mentions }: { content: string; mentions: string[] }) =>
            commentsApi.create(taskId, content, mentions),
        onMutate: async ({ content }) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            const tempComment: TaskComment = {
                id: `temp-${Date.now()}`,
                task_id: taskId,
                author_id: 'current-user',
                author_name: 'Tu',
                content,
                mentions: [],
                reactions: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            optimistic(old => ({
                ...old,
                comments: [tempComment, ...old.comments],
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Delete comment
    const deleteComment = useMutation({
        mutationFn: (commentId: string) =>
            commentsApi.delete(taskId, commentId),
        onMutate: async (commentId) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({
                ...old,
                comments: old.comments.filter(c => c.id !== commentId),
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Due date change
    const changeDueDate = useMutation({
        mutationFn: ({ date, reason }: { date: string; reason: string }) =>
            tasksApi.changeDueDate(taskId, date, reason),
        onMutate: async ({ date }) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({ ...old, due_date: date }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Recurring toggle
    const toggleRecurring = useMutation({
        mutationFn: async () => {
            if (task?.is_recurring) {
                await recurringApi.remove(taskId);
            } else {
                await recurringApi.set(taskId, 'weekly');
            }
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({ ...old, is_recurring: !old.is_recurring }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Delete task
    const deleteTask = useMutation({
        mutationFn: () => tasksApi.delete(taskId),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        },
    });

    // Add alert
    const addAlert = useMutation({
        mutationFn: (content: string) => alertsApi.create(taskId, content),
        onSettled: () => refetch(),
    });

    // Resolve alert
    const resolveAlert = useMutation({
        mutationFn: (alertId: string) => alertsApi.resolve(taskId, alertId),
        onMutate: async (alertId) => {
            await queryClient.cancelQueries({ queryKey: TASK_KEY(taskId) });
            const ctx = snapshot();
            optimistic(old => ({
                ...old,
                alerts: old.alerts.map((a: TaskAlert) =>
                    a.id === alertId ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a
                ),
            }));
            return ctx;
        },
        onError: (_e, _v, ctx) => ctx && rollback(ctx),
        onSettled: () => refetch(),
    });

    // Reorder subtasks
    const reorderSubtasks = useMutation({
        mutationFn: (order: { id: string; order_index: number }[]) =>
            subtasksApi.reorder(taskId, order),
        onSettled: () => refetch(),
    });

    return {
        task: task ?? null,
        loading,
        refetch,

        // Mutations
        changeStatus,
        updateTask,
        toggleSubtask,
        addSubtask,
        deleteSubtask,
        updateSubtask,
        addComment,
        deleteComment,
        changeDueDate,
        toggleRecurring,
        deleteTask,
        addAlert,
        resolveAlert,
        reorderSubtasks,
    };
}
