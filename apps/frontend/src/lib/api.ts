import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// ==================== MCP API ====================

export interface McpResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function callMcpTool<T = any>(
    name: string,
    args: Record<string, any> = {}
): Promise<McpResponse<T>> {
    const response = await api.post('/api/mcp', {
        method: 'tools/call',
        params: { name, arguments: args },
    });
    return response.data;
}

export async function listMcpTools() {
    const response = await api.post('/api/mcp', { method: 'tools/list' });
    return response.data;
}

// ==================== WORKFLOWS API ====================

export async function getWorkflows() {
    const response = await api.get('/api/workflows');
    return response.data;
}

export async function getWorkflow(id: string) {
    const response = await api.get(`/api/workflows/${id}`);
    return response.data;
}

export async function toggleWorkflow(id: string, active: boolean) {
    const response = await api.patch(`/api/workflows/${id}/toggle`, { active });
    return response.data;
}

export async function deleteWorkflow(id: string) {
    const response = await api.delete(`/api/workflows/${id}`);
    return response.data;
}

// ==================== EXECUTIONS API ====================

export async function getExecutions(limit = 50) {
    const response = await api.get('/api/executions', { params: { limit } });
    return response.data;
}

export async function getExecution(id: string) {
    const response = await api.get(`/api/executions/${id}`);
    return response.data;
}

// ==================== CREDENTIALS API ====================

export async function getCredentials() {
    const response = await api.get('/api/credentials');
    return response.data;
}

export async function deleteCredential(id: string) {
    const response = await api.delete(`/api/credentials/${id}`);
    return response.data;
}

// ==================== USER API ====================

export async function getCurrentUser() {
    const response = await api.get('/api/users/me');
    return response.data;
}

export async function getUserUsage() {
    const response = await api.get('/api/users/me/usage');
    return response.data;
}
