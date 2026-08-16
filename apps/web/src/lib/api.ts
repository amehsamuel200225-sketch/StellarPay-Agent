// API client for StellarPay backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('stellarpay_token');
}

export function setToken(token: string): void {
  localStorage.setItem('stellarpay_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('stellarpay_token');
  localStorage.removeItem('stellarpay_user');
}

export function getStoredUser(): { id: string; email: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('stellarpay_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setStoredUser(user: { id: string; email: string }): void {
  localStorage.setItem('stellarpay_user', JSON.stringify(user));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => request<{ user: { id: string; email: string } }>('/auth/me'),
  },

  agents: {
    list: () =>
      request<{ agents: Agent[] }>('/agents'),

    get: (id: string) =>
      request<{ agent: Agent; balances: { xlm: string; usdc: string } }>(`/agents/${id}`),

    create: (data: { name: string; description?: string; dailyLimit?: number; perTxLimit?: number; asset?: string }) =>
      request<{ agent: Agent; publicKey: string }>('/agents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateLimits: (id: string, data: { dailyLimit?: number; perTxLimit?: number }) =>
      request<{ agent: Agent }>(`/agents/${id}/limits`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    revoke: (id: string) =>
      request<{ message: string }>(`/agents/${id}/revoke`, { method: 'PUT' }),

    restore: (id: string) =>
      request<{ message: string }>(`/agents/${id}/restore`, { method: 'PUT' }),
  },

  payments: {
    list: (limit?: number, offset?: number) =>
      request<{ transactions: Transaction[]; total: number }>(`/payments?limit=${limit || 50}&offset=${offset || 0}`),

    forAgent: (agentId: string) =>
      request<{ transactions: Transaction[] }>(`/payments/agent/${agentId}`),

    send: (data: { agentId: string; destination: string; amount: string; memo?: string }) =>
      request<{ transaction: Transaction; remainingToday: number }>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

// Types
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  publicKey: string;
  asset: string;
  dailyLimit: number;
  perTxLimit: number;
  dailySpent: number;
  lastResetAt: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  agent_id: string;
  user_id: string;
  tx_hash: string | null;
  amount: number;
  asset: string;
  destination: string;
  memo: string | null;
  status: 'success' | 'failed' | 'rejected' | 'pending';
  rejection_reason: string | null;
  explorer_url: string | null;
  agent_name?: string;
  agent_public_key?: string;
  created_at: string;
}
