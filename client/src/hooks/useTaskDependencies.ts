import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dependenciesApi } from '../services/api';
import type { TaskDependency } from '../types';

export function useTaskDependencies(taskId: string) {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['task-dependencies', taskId],
        queryFn: () => dependenciesApi.list(taskId) as Promise<{ blocks: TaskDependency[]; blocked_by: TaskDependency[] }>,
        enabled: !!taskId,
    });

    const addDep = useMutation({
        mutationFn: (dep: { blocking_task_id: string; blocked_task_id: string }) =>
            dependenciesApi.add(taskId, dep),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
            queryClient.invalidateQueries({ queryKey: ['task', taskId] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const removeDep = useMutation({
        mutationFn: (depId: string) => dependenciesApi.remove(taskId, depId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
            queryClient.invalidateQueries({ queryKey: ['task', taskId] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    return {
        blocks: data?.blocks ?? [],
        blockedBy: data?.blocked_by ?? [],
        isLoading,
        addDependency: addDep.mutate,
        removeDependency: removeDep.mutate,
        isAdding: addDep.isPending,
    };
}
