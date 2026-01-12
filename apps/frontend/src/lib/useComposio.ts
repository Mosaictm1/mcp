import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// ==================== TYPES ====================

export interface ComposioConnection {
    id: string;
    integrationId: string;
    toolkitName: string;
    status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'FAILED';
    createdAt: string;
}

export interface ComposioToolkit {
    id: string;
    name: string;
    icon?: string;
    description?: string;
}

export interface InitiateConnectionParams {
    authConfigId: string;
    callbackUrl?: string;
    toolkitName?: string;
}

export interface InitiateConnectionResponse {
    redirectUrl: string;
    connectionRequestId: string;
}

// ==================== API FUNCTIONS ====================

async function getComposioStatus(): Promise<{ configured: boolean; message: string }> {
    const response = await api.get('/api/composio/status');
    return response.data;
}

async function getComposioConnections(): Promise<{ connections: ComposioConnection[] }> {
    const response = await api.get('/api/composio/connections');
    return response.data;
}

async function initiateConnection(params: InitiateConnectionParams): Promise<InitiateConnectionResponse> {
    const response = await api.post('/api/composio/connect', params);
    return response.data;
}

async function verifyConnection(
    connectionId: string,
    toolkitName?: string,
    authConfigId?: string
): Promise<{ verified: boolean; connection?: ComposioConnection; status?: string }> {
    const response = await api.post(`/api/composio/connections/${connectionId}/verify`, {
        toolkitName,
        authConfigId,
    });
    return response.data;
}

async function deleteConnection(connectionId: string): Promise<void> {
    await api.delete(`/api/composio/connections/${connectionId}`);
}

async function getToolkits(): Promise<{ toolkits: ComposioToolkit[] }> {
    const response = await api.get('/api/composio/toolkits');
    return response.data;
}

// ==================== HOOKS ====================

/**
 * Hook to check if Composio is configured
 */
export function useComposioStatus() {
    return useQuery({
        queryKey: ['composio-status'],
        queryFn: getComposioStatus,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to get user's Composio connections
 */
export function useComposioConnections() {
    return useQuery({
        queryKey: ['composio-connections'],
        queryFn: getComposioConnections,
    });
}

/**
 * Hook to get available toolkits
 */
export function useComposioToolkits() {
    return useQuery({
        queryKey: ['composio-toolkits'],
        queryFn: getToolkits,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Hook to initiate a new connection
 */
export function useInitiateConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: initiateConnection,
        onSuccess: () => {
            // Will be refreshed after callback
        },
    });
}

/**
 * Hook to verify a connection after OAuth callback
 */
export function useVerifyConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ connectionId, toolkitName, authConfigId }: {
            connectionId: string;
            toolkitName?: string;
            authConfigId?: string;
        }) => verifyConnection(connectionId, toolkitName, authConfigId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['composio-connections'] });
        },
    });
}

/**
 * Hook to delete a connection
 */
export function useDeleteConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteConnection,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['composio-connections'] });
        },
    });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Open OAuth popup for Composio connection
 */
export function openComposioPopup(
    redirectUrl: string,
    onSuccess?: (connectionId: string) => void,
    onError?: (error: string) => void
): Window | null {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
        redirectUrl,
        'composio-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
        onError?.('Popup blocked. Please allow popups for this site.');
        return null;
    }

    // Poll for popup close and check URL
    const checkInterval = setInterval(() => {
        try {
            if (popup.closed) {
                clearInterval(checkInterval);
                return;
            }

            // Check if we're back on our domain
            const currentUrl = popup.location.href;
            if (currentUrl.includes(window.location.origin)) {
                const url = new URL(currentUrl);
                const connectionId = url.searchParams.get('connection_id');
                const success = url.searchParams.get('composio_success');
                const error = url.searchParams.get('composio_error');

                popup.close();
                clearInterval(checkInterval);

                if (success && connectionId) {
                    onSuccess?.(connectionId);
                } else if (error) {
                    onError?.(url.searchParams.get('message') || 'Connection failed');
                }
            }
        } catch (e) {
            // Cross-origin error - popup is on different domain, keep waiting
        }
    }, 500);

    return popup;
}

/**
 * Handle Composio callback from URL params (for redirect flow)
 */
export function handleComposioCallback(): {
    isCallback: boolean;
    success: boolean;
    connectionId?: string;
    error?: string;
} {
    const params = new URLSearchParams(window.location.search);
    const isCallback = params.has('composio_success') || params.has('composio_error');

    if (!isCallback) {
        return { isCallback: false, success: false };
    }

    const success = params.get('composio_success') === 'true';
    const connectionId = params.get('connection_id') || undefined;
    const error = params.get('message') || undefined;

    // Clean up URL
    if (isCallback) {
        const url = new URL(window.location.href);
        url.searchParams.delete('composio_success');
        url.searchParams.delete('composio_error');
        url.searchParams.delete('connection_id');
        url.searchParams.delete('message');
        window.history.replaceState({}, '', url.pathname);
    }

    return { isCallback, success, connectionId, error };
}
