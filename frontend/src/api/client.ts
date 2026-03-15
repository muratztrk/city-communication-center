import type { Dashboard, Department, User, Task, SocialMessage, AuditLog } from '../types';

const API_BASE = 'http://localhost:5100/api/v1';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('ccc_token');
  const user = localStorage.getItem('ccc_user');
  const tenantId = user ? JSON.parse(user).tenantId : 'A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D';
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export const api = {
  async getDashboard(): Promise<Dashboard> {
    const res = await fetch(`${API_BASE}/reports/dashboard`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/organizations/departments`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  async createDepartment(name: string, departmentType: string): Promise<Department> {
    const res = await fetch(`${API_BASE}/organizations/departments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, departmentType }),
    });
    if (!res.ok) throw new Error('Failed to create department');
    return res.json();
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async getTasks(): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async createTask(task: { title: string; description: string; taskType: string; sourceType: string; priority: string; targetDepartmentId?: string }): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async submitTask(taskId: string, note?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error('Failed to submit task');
  },

  async approveTask(taskId: string, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) throw new Error('Failed to approve task');
  },

  async completeTask(taskId: string, resultNote?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ resultNote }),
    });
    if (!res.ok) throw new Error('Failed to complete task');
  },

  async getSocialMessages(): Promise<SocialMessage[]> {
    const res = await fetch(`${API_BASE}/social/messages`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch social messages');
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },
};
