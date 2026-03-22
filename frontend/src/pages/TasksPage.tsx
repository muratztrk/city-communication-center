import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { AutocompleteField } from '../components/AutocompleteField';
import type { Task, Department, User } from '../types';
import { getPriorityLabel, getRoleLabel, getTaskStatusLabel, getTaskTypeLabel, getUserSourceLabel } from '../utils/localization';

export function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, { departmentId: string; userId: string }>>({});
  const [assignmentQueries, setAssignmentQueries] = useState<Record<string, string>>({});
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
    const draft = assignmentDrafts[taskId];
    const task = tasks.find(candidate => candidate.taskId === taskId);
    const departmentId = draft
      ? draft.departmentId || undefined
      : task?.assignedDepartmentId ?? task?.targetDepartmentId ?? undefined;
    const userId = draft
      ? draft.userId || undefined
      : task?.assignedUserId ?? undefined;

    setError(null);
    try {
      await api.assignTask(taskId, departmentId, userId);
      setAssignmentDrafts(current => ({
        ...current,
        [taskId]: { departmentId: '', userId: '' },
      }));
      setAssignmentQueries(current => ({ ...current, [taskId]: '' }));
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
    setAssignmentQueries(current => ({ ...current, [taskId]: '' }));
  };

  const getAssignableUsers = (taskId: string, task: Task) => {
    const selectedDepartmentId = assignmentDrafts[taskId]?.departmentId
      ?? task.assignedDepartmentId
      ?? task.targetDepartmentId
      ?? '';

    return selectedDepartmentId
      ? users.filter(user => user.departmentId === selectedDepartmentId && user.isActive)
      : users.filter(user => user.isActive);
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return '-';
    return departments.find(department => department.departmentId === departmentId)?.name ?? '-';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    return users.find(user => user.userId === userId)?.displayName ?? '-';
  };

  const getSelectedUser = (taskId: string, task: Task) => {
    const draft = assignmentDrafts[taskId];
    const selectedUserId = draft ? draft.userId : task.assignedUserId;
    return users.find(user => user.userId === selectedUserId) ?? null;
  };

  const getUserSearchValue = (taskId: string, task: Task) => {
    if (Object.prototype.hasOwnProperty.call(assignmentQueries, taskId)) {
      return assignmentQueries[taskId] ?? '';
    }

    return getSelectedUser(taskId, task)?.displayName ?? '';
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

  if (loading) return <div className="loading">{t('common.loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>📋 {t('tasks.title')}</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('tasks.newCancel') : t('tasks.new')}
        </button>
      </div>

      {error && <div className="error">{t('common.error')}: {error}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.titleLabel')}</label>
              <input
                id="task-title"
                type="text"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder={t('tasks.titlePlaceholder')}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('tasks.priority')}</label>
              <select id="task-priority" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                <option value="Low">{getPriorityLabel(t, 'Low')}</option>
                <option value="Normal">{getPriorityLabel(t, 'Normal')}</option>
                <option value="High">{getPriorityLabel(t, 'High')}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('tasks.description')}</label>
            <textarea
              id="task-description"
              value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              placeholder={t('tasks.descriptionPlaceholder')}
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('tasks.type')}</label>
              <select id="task-type" value={newTask.taskType} onChange={e => setNewTask({ ...newTask, taskType: e.target.value })}>
                <option value="InternalRequest">{getTaskTypeLabel(t, 'InternalRequest')}</option>
                <option value="CitizenRequest">{getTaskTypeLabel(t, 'CitizenRequest')}</option>
                <option value="ApprovalTask">{getTaskTypeLabel(t, 'ApprovalTask')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('tasks.targetDepartment')}</label>
              <select id="task-target-department" value={newTask.targetDepartmentId} onChange={e => setNewTask({ ...newTask, targetDepartmentId: e.target.value })}>
                <option value="">{t('tasks.selectDepartment')}</option>
                {departments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn primary">{t('common.create')}</button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('tasks.titleLabel')}</th>
              <th>{t('tasks.type')}</th>
              <th>{t('tasks.priority')}</th>
              <th>{t('common.status')}</th>
              <th>{t('tasks.department')}</th>
              <th>{t('tasks.assignedTo')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.taskId}>
                <td>
                  <strong>{task.title}</strong>
                  {task.description && <div className="text-muted">{task.description.substring(0, 50)}...</div>}
                </td>
                <td>{getTaskTypeLabel(t, task.taskType)}</td>
                <td><span className={getPriorityBadge(task.priority)}>{getPriorityLabel(t, task.priority)}</span></td>
                <td><span className={getStatusBadge(task.currentStatus)}>{getTaskStatusLabel(t, task.currentStatus)}</span></td>
                <td>{getDepartmentName(task.assignedDepartmentId ?? task.targetDepartmentId)}</td>
                <td>{getUserName(task.assignedUserId)}</td>
                <td className="actions">
                  {task.currentStatus === 'Draft' && (
                    <button className="btn small" onClick={() => handleAction(task.taskId, 'submit')}>{t('tasks.submit')}</button>
                  )}
                  {task.currentStatus === 'PendingApproval' && (
                    <>
                      <button className="btn small success" onClick={() => handleAction(task.taskId, 'approve')}>{t('tasks.approve')}</button>
                      <button className="btn small danger" onClick={() => handleAction(task.taskId, 'reject')}>{t('tasks.reject')}</button>
                    </>
                  )}
                  {(task.currentStatus === 'Draft' || task.currentStatus === 'Assigned') && (
                    <div className="table-actions">
                      <select
                        aria-label={`Departman seç ${task.title}`}
                        value={assignmentDrafts[task.taskId]?.departmentId ?? task.assignedDepartmentId ?? task.targetDepartmentId ?? ''}
                        onChange={e => updateAssignmentDepartment(task.taskId, e.target.value)}
                      >
                        <option value="">{t('tasks.draftDepartment')}</option>
                        {departments.map(department => (
                          <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                        ))}
                      </select>
                      <AutocompleteField
                        ariaLabel={`Kullanıcı seç ${task.title}`}
                        emptyMessage={t('tasks.userSearchEmpty')}
                        loadingMessage={t('common.loading')}
                        options={getAssignableUsers(task.taskId, task)
                          .filter(user => {
                            const currentQuery = getUserSearchValue(task.taskId, task).trim().toLowerCase();
                            if (!currentQuery) {
                              return true;
                            }

                            return user.displayName.toLowerCase().includes(currentQuery) || (user.email?.toLowerCase().includes(currentQuery) ?? false);
                          })
                          .map(user => ({
                            id: user.userId,
                            label: user.displayName,
                            description: [user.email, getRoleLabel(t, user.roleCode)].filter(Boolean).join(' • '),
                            helperText: getUserSourceLabel(t, user.userSource),
                          }))}
                        placeholder={t('tasks.userSearchPlaceholder')}
                        value={getUserSearchValue(task.taskId, task)}
                        onOptionSelect={option => {
                          updateAssignmentDraft(task.taskId, 'userId', option.id);
                          setAssignmentQueries(current => ({ ...current, [task.taskId]: option.label }));
                        }}
                        onValueChange={value => {
                          setAssignmentQueries(current => ({ ...current, [task.taskId]: value }));
                          if (!value.trim()) {
                            updateAssignmentDraft(task.taskId, 'userId', '');
                          }
                        }}
                      />
                      <button className="btn small" onClick={() => handleAssign(task.taskId)}>{t('tasks.assign')}</button>
                      {task.currentStatus === 'Assigned' && (
                        <button className="btn small success" onClick={() => handleAction(task.taskId, 'complete')}>{t('tasks.complete')}</button>
                      )}
                    </div>
                  )}
                  {(task.currentStatus === 'Completed' || task.currentStatus === 'Rejected') && (
                    <button className="btn small" onClick={() => handleAction(task.taskId, 'close')}>{t('tasks.close')}</button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={7} className="text-center">{t('tasks.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
