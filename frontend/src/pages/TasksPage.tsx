import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Task, Department, User } from '../types';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, { departmentId: string; userId: string }>>({});
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
    setError(null);
    Promise.all([api.getTasks(), api.getDepartments(), api.getUsers()])
      .then(([tasks, depts, users]) => {
        setTasks(tasks);
        setDepartments(depts);
        setUsers(users);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([api.getTasks(), api.getDepartments(), api.getUsers()])
      .then(([tasks, depts, users]) => {
        setTasks(tasks);
        setDepartments(depts);
        setUsers(users);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setError(null);
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

  const handleAction = async (taskId: string, action: 'submit' | 'approve' | 'reject' | 'complete' | 'close') => {
    setError(null);
    try {
      if (action === 'submit') await api.submitTask(taskId);
      else if (action === 'approve') await api.approveTask(taskId);
      else if (action === 'reject') await api.rejectTask(taskId);
      else if (action === 'complete') await api.completeTask(taskId);
      else if (action === 'close') await api.closeTask(taskId);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleAssign = async (taskId: string) => {
    const draft = assignmentDrafts[taskId] ?? { departmentId: '', userId: '' };

    setError(null);
    try {
      await api.assignTask(taskId, draft.departmentId || undefined, draft.userId || undefined);
      setAssignmentDrafts(current => ({
        ...current,
        [taskId]: { departmentId: '', userId: '' },
      }));
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateAssignmentDraft = (taskId: string, field: 'departmentId' | 'userId', value: string) => {
    setAssignmentDrafts(current => ({
      ...current,
      [taskId]: {
        departmentId: current[taskId]?.departmentId ?? '',
        userId: current[taskId]?.userId ?? '',
        [field]: value,
      },
    }));
  };

  const updateAssignmentDepartment = (taskId: string, departmentId: string) => {
    setAssignmentDrafts(current => {
      const currentDraft = current[taskId] ?? { departmentId: '', userId: '' };
      const nextUserId = currentDraft.userId && users.find(user => user.userId === currentDraft.userId)?.departmentId === departmentId
        ? currentDraft.userId
        : '';

      return {
        ...current,
        [taskId]: {
          departmentId,
          userId: nextUserId,
        },
      };
    });
  };

  const getAssignableUsers = (taskId: string, task: Task) => {
    const selectedDepartmentId = assignmentDrafts[taskId]?.departmentId
      ?? task.assignedDepartmentId
      ?? task.targetDepartmentId
      ?? '';

    return selectedDepartmentId
      ? users.filter(user => user.departmentId === selectedDepartmentId)
      : users;
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return '-';
    return departments.find(department => department.departmentId === departmentId)?.name ?? '-';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    return users.find(user => user.userId === userId)?.displayName ?? '-';
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High': return 'badge danger';
      case 'Normal': return 'badge';
      case 'Low': return 'badge success';
      default: return 'badge';
    }
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>📋 Görevler</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'İptal' : '+ Yeni Görev'}
        </button>
      </div>

      {error && <div className="error">Hata: {error}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>Başlık</label>
              <input
                id="task-title"
                type="text"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Görev başlığı"
                required
              />
            </div>
            <div className="form-group">
              <label>Öncelik</label>
              <select id="task-priority" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                <option value="Low">Düşük</option>
                <option value="Normal">Normal</option>
                <option value="High">Yüksek</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Açıklama</label>
            <textarea
              id="task-description"
              value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Görev açıklaması"
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Görev Türü</label>
              <select id="task-type" value={newTask.taskType} onChange={e => setNewTask({ ...newTask, taskType: e.target.value })}>
                <option value="InternalRequest">İç Talep</option>
                <option value="CitizenRequest">Vatandaş Talebi</option>
                <option value="ApprovalTask">Onay Görevi</option>
              </select>
            </div>
            <div className="form-group">
              <label>Hedef Departman</label>
              <select id="task-target-department" value={newTask.targetDepartmentId} onChange={e => setNewTask({ ...newTask, targetDepartmentId: e.target.value })}>
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
              <th>Departman</th>
              <th>Atanan</th>
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
                <td>{task.taskType}</td>
                <td><span className={getPriorityBadge(task.priority)}>{task.priority}</span></td>
                <td><span className={getStatusBadge(task.currentStatus)}>{task.currentStatus}</span></td>
                <td>{getDepartmentName(task.assignedDepartmentId ?? task.targetDepartmentId)}</td>
                <td>{getUserName(task.assignedUserId)}</td>
                <td className="actions">
                  {task.currentStatus === 'Draft' && (
                    <button className="btn small" onClick={() => handleAction(task.taskId, 'submit')}>Gönder</button>
                  )}
                  {task.currentStatus === 'PendingApproval' && (
                    <>
                      <button className="btn small success" onClick={() => handleAction(task.taskId, 'approve')}>Onayla</button>
                      <button className="btn small danger" onClick={() => handleAction(task.taskId, 'reject')}>Reddet</button>
                    </>
                  )}
                  {(task.currentStatus === 'Draft' || task.currentStatus === 'Assigned') && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <select
                        aria-label={`Departman seç ${task.title}`}
                        value={assignmentDrafts[task.taskId]?.departmentId ?? task.assignedDepartmentId ?? task.targetDepartmentId ?? ''}
                        onChange={e => updateAssignmentDepartment(task.taskId, e.target.value)}
                      >
                        <option value="">Departman</option>
                        {departments.map(department => (
                          <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Kullanıcı seç ${task.title}`}
                        value={assignmentDrafts[task.taskId]?.userId ?? task.assignedUserId ?? ''}
                        onChange={e => updateAssignmentDraft(task.taskId, 'userId', e.target.value)}
                      >
                        <option value="">Kullanıcı</option>
                        {getAssignableUsers(task.taskId, task).map(user => (
                          <option key={user.userId} value={user.userId}>{user.displayName}</option>
                        ))}
                      </select>
                      <button className="btn small" onClick={() => handleAssign(task.taskId)}>Ata</button>
                      {task.currentStatus === 'Assigned' && (
                        <button className="btn small success" onClick={() => handleAction(task.taskId, 'complete')}>Tamamla</button>
                      )}
                    </div>
                  )}
                  {(task.currentStatus === 'Completed' || task.currentStatus === 'Rejected') && (
                    <button className="btn small" onClick={() => handleAction(task.taskId, 'close')}>Kapat</button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={7} className="text-center">Henüz görev bulunmuyor</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
