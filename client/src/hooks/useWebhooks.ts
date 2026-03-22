import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhookApi } from '../services/api';

export function useWebhooks() {
    return useQuery({ queryKey: ['webhooks'], queryFn: webhookApi.getAll });
}

export function useWebhookDeliveries(params?: Parameters<typeof webhookApi.getDeliveries>[0]) {
    return useQuery({
        queryKey: ['webhook-deliveries', params],
        queryFn: () => webhookApi.getDeliveries(params),
        refetchInterval: 30000
    });
}

export function useCreateWebhook() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: webhookApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] })
    });
}

export function useUpdateWebhook() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => webhookApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] })
    });
}

export function useDeleteWebhook() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: webhookApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] })
    });
}

export function useTestWebhook() {
    return useMutation({ mutationFn: webhookApi.test });
}
