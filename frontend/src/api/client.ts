import type { Dashboard, Department, User, Task, SocialMessage, AuditLog } from '../types';
import { getStoredSession, getValidAccessToken } from './auth';
import { API_BASE } from './config';

async function getHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken();
  const tenantId = getStoredSession()?.user.tenantId ?? null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

async function getErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const responseText = await response.text();
  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(responseText) as {
      title?: string;
      detail?: string;
      message?: string;
      error?: string;
      error_description?: string;
      errors?: Record<string, string[]>;
    };

    const validationMessages = payload.errors
      ? Object.values(payload.errors).flat().filter(Boolean)
      : [];

    if (validationMessages.length > 0) {
      return Array.from(new Set(validationMessages)).join('\n');
    }

    return payload.detail
      ?? payload.error_description
      ?? payload.message
      ?? payload.error
      ?? payload.title
      ?? fallbackMessage;
  } catch {
    return responseText || fallbackMessage;
  }
}

async function ensureOk(response: Response, fallbackMessage: string): Promise<Response> {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage));
  }

  return response;
}

export const api = {
  async getDashboard(): Promise<Dashboard> {
    const res = await fetch(`${API_BASE}/reports/dashboard`, { headers: await getHeaders() });
    await ensureOk(res, 'Panel verileri alınamadı.');
    return res.json();
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/departments`, { headers: await getHeaders() });
    await ensureOk(res, 'Departmanlar alınamadı.');
    return res.json();
  },

  async createDepartment(name: string, departmentType: string): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, departmentType }),
    });
    await ensureOk(res, 'Departman oluşturulamadı.');
    return res.json();
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: await getHeaders() });
    await ensureOk(res, 'Kullanıcılar alınamadı.');
    return res.json();
  },

  async getTasks(): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks`, { headers: await getHeaders() });
    await ensureOk(res, 'Görevler alınamadı.');
    return res.json();
  },

  async createTask(task: { title: string; description: string; taskType: string; sourceType: string; priority: string; targetDepartmentId?: string }): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(task),
    });
    await ensureOk(res, 'Görev oluşturulamadı.');
    return res.json();
  },

  async submitTask(taskId: string, note?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ note }),
    });
    await ensureOk(res, 'Görev gönderilemedi.');
  },

  async approveTask(taskId: string, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ comment }),
    });
    await ensureOk(res, 'Görev onaylanamadı.');
  },

  async rejectTask(taskId: string, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ comment }),
    });
    await ensureOk(res, 'Görev reddedilemedi.');
  },

  async assignTask(taskId: string, departmentId?: string, userId?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ departmentId: departmentId || null, userId: userId || null, actionType: 'Assign' }),
    });
    await ensureOk(res, 'Görev atanamadı.');
  },

  async completeTask(taskId: string, resultNote?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ resultNote }),
    });
    await ensureOk(res, 'Görev tamamlanamadı.');
  },

  async closeTask(taskId: string, closureNote?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/close`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ closureNote }),
    });
    await ensureOk(res, 'Görev kapatılamadı.');
  },

  async getSocialMessages(): Promise<SocialMessage[]> {
    const res = await fetch(`${API_BASE}/social/messages`, { headers: await getHeaders() });
    await ensureOk(res, 'Sosyal mesajlar alınamadı.');
    return res.json();
  },

  async routeSocialMessage(socialMessageId: string, departmentId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/social/messages/${socialMessageId}/route`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ departmentId, userId: null }),
    });
    await ensureOk(res, 'Sosyal mesaj yönlendirilemedi.');
  },

  async convertSocialMessageToTask(socialMessageId: string, payload: { title: string; description: string; priority: string; dueDateUtc?: string | null }): Promise<void> {
    const res = await fetch(`${API_BASE}/social/messages/${socialMessageId}/convert`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, 'Sosyal mesaj göreve dönüştürülemedi.');
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, { headers: await getHeaders() });
    await ensureOk(res, 'Denetim kayıtları alınamadı.');
    return res.json();
  },
};
