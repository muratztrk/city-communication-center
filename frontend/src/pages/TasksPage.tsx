import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Task, Department } from '../types';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    taskType: 'InternalRequest',
    sourceType: 'Manual',
    priority: 'Normal',
    targetDepartmentId: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([api.getTasks(), api.getDepartments()])
      .then(([tasks, depts]) => {
        setTasks(tasks);
        setDepartments(depts);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      await api.createTask({
        ...newTask,
        targetDepartmentId: newTask.targetDepartmentId || undefined,
      });
      setNewTask({ title: '', description: '', taskType: 'InternalRequest', sourceType: 'Manual', priority: 'Normal', targetDepartmentId: '' });
      setShowForm(false);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleAction = async (taskId: string, action: 'submit' | 'approve' | 'complete') => {
    try {
      if (action === 'submit') await api.submitTask(taskId);
      else if (action === 'approve') await api.approveTask(taskId);
      else if (action === 'complete') await api.completeTask(taskId);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      Draft: 'badge',
      PendingApproval: 'badge warning',
      Assigned: 'badge info',
      InProgress: 'badge info',
      Completed: 'badge success',
      Closed: 'badge',
      Rejected: 'badge danger',
    };
    return map[status] || 'badge';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      Draft: 'Taslak',
      PendingApproval: 'Onay Bekliyor',
      Assigned: 'Atandı',
      InProgress: 'Devam Ediyor',
      Completed: 'Tamamlandı',
      Closed: 'Kapatıldı',
      Rejected: 'Reddedildi',
    };
    return map[status] || status;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High': return 'badge danger';
      case 'Normal': return 'badge';
      case 'Low': return 'badge success';
      default: return 'badge';
    }
  };

  const getPriorityLabel = (priority: string) => {
    const map: Record<string, string> = {
      High: 'Yüksek',
      Normal: 'Normal',
      Low: 'Düşük',
    };
    return map[priority] || priority;
  };

  const getTaskTypeLabel = (taskType: string) => {
    const map: Record<string, string> = {
      InternalRequest: 'İç Talep',
      CitizenRequest: 'Vatandaş Talebi',
      ApprovalTask: 'Onay Görevi',
      Complaint: 'Şikayet',
      Suggestion: 'Öneri',
    };
    return map[taskType] || taskType;
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (error) return <div className="error">Hata: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>📋 Görevler</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'İptal' : '+ Yeni Görev'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>Başlık</label>
              <input
                type="text"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Görev başlığı"
                required
              />
            </div>
            <div className="form-group">
              <label>Öncelik</label>
              <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                <option value="Low">Düşük</option>
                <option value="Normal">Normal</option>
                <option value="High">Yüksek</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Açıklama</label>
            <textarea
              value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Görev açıklaması"
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Görev Türü</label>
              <select value={newTask.taskType} onChange={e => setNewTask({ ...newTask, taskType: e.target.value })}>
                <option value="InternalRequest">İç Talep</option>
                <option value="CitizenRequest">Vatandaş Talebi</option>
                <option value="Complaint">Şikayet</option>
                <option value="Suggestion">Öneri</option>
              </select>
            </div>
            <div className="form-group">
              <label>Hedef Departman</label>
              <select value={newTask.targetDepartmentId} onChange={e => setNewTask({ ...newTask, targetDepartmentId: e.target.value })}>
                <option value="">Seçiniz...</option>
                {departments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn primary">Oluştur</button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Tür</th>
              <th>Öncelik</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.taskId}>
                <td>
                  <strong>{task.title}</strong>
                  {task.description && <div className="text-muted">{task.description.substring(0, 50)}...</div>}
                </td>
                <td>{getTaskTypeLabel(task.taskType)}</td>
                <td><span className={getPriorityBadge(task.priority)}>{getPriorityLabel(task.priority)}</span></td>
                <td><span className={getStatusBadge(task.currentStatus)}>{getStatusLabel(task.currentStatus)}</span></td>
                <td className="actions">
                  {task.currentStatus === 'Draft' && (
                    <button className="btn small" onClick={() => handleAction(task.taskId, 'submit')}>Gönder</button>
                  )}
                  {task.currentStatus === 'PendingApproval' && (
                    <button className="btn small success" onClick={() => handleAction(task.taskId, 'approve')}>Onayla</button>
                  )}
                  {task.currentStatus === 'Assigned' && (
                    <button className="btn small success" onClick={() => handleAction(task.taskId, 'complete')}>Tamamla</button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="text-center">Henüz görev bulunmuyor</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
